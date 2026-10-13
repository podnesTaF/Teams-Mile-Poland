/**
 * One-off: publish the 10.10.2026 night (mile-2026-10-10) and pay
 * participation. The organiser sent the results as a screenshot of
 * RaceResult's "Results by Heat" view (six individual miles, Heat-1), so the
 * input is a hand-transcribed CSV in that same by-heat layout: `Heat-1` banner,
 * `Rank | Bib | Athlete | Gender | DoB | Country | 9 m … 1609 m | Level |
 * Result`. It goes through the admin tab's own path — parseResultsFile →
 * resolveRegistrations → replaceHeatResults — so splits land in
 * `event_results.splits` like 22.09 / 01.10.
 *
 * Before the import, as on 22.09 and 01.10: a `confirmed` registration for
 * every runner who has an account but raced unregistered (unique name key, or
 * DoB + name token, or an explicit alias — never a guess), so the result links
 * and the profile shows the run. Then PARTICIPATION_REWARD_ACER to every
 * starter with an account under `participation:<registrationId>`, the same key
 * the check-in accrual uses, so nothing can pay the night twice.
 *
 *   npx tsx --env-file=.env.local scripts/import-1010-results.ts <file.csv>
 *   npx tsx --env-file=.env.local scripts/import-1010-results.ts <file.csv> --write
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { eq } from "drizzle-orm";

import { eventRegistrations, users } from "../src/db/schema";
import {
  replaceHeatResults,
  resolveRegistrations,
  unknownHeatNumbers,
} from "../src/features/admin/results-import/data";
import { parseResultsFile } from "../src/features/admin/results-import/parse";
import { PARTICIPATION_REWARD_ACER, acerToMinor } from "../src/features/wallet/config";
import { recordWalletTransaction } from "../src/features/wallet/data";
import { getDb } from "../src/lib/db";
import { nameKey } from "../src/lib/events/name-key";
import { getEventBySlug } from "../src/lib/events/store";
import { formatTime } from "../src/lib/events/time";

const SLUG = "mile-2026-10-10";
const WRITE = process.argv.includes("--write");
const filePath = process.argv[2];

/** Timing-file name → account email, where no rule links them. None needed on 10.10. */
const ALIASES: Record<string, string> = {};

async function main() {
  if (!filePath || filePath.startsWith("--")) {
    console.error("Usage: tsx scripts/import-1010-results.ts <results file> [--write]");
    process.exit(1);
  }
  const db = getDb();
  const host = new URL(process.env.DATABASE_URL ?? "postgres://unset/").hostname;
  console.log(`${WRITE ? "WRITE" : "dry-run"} against ${host}, event ${SLUG}`);

  const event = await getEventBySlug(SLUG);
  if (!event) throw new Error(`No event row for ${SLUG}`);
  console.log(`Event: ${event.name ?? SLUG} — status "${event.status}"`);

  const parsed = await parseResultsFile(basename(filePath), readFileSync(filePath));
  for (const e of parsed.errors) console.log(`  parser refused row ${e.sourceRow}: ${e.message}`);
  if (parsed.rows.length === 0) throw new Error("No parseable rows.");

  // ── accounts and registrations for everyone who started ───────────
  const started = parsed.rows.filter((r) => r.status !== "dns");
  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      name: users.name,
      dateOfBirth: users.dateOfBirth,
    })
    .from(users);
  const loadRegs = async () =>
    new Map(
      (
        await db
          .select({ id: eventRegistrations.id, userId: eventRegistrations.userId })
          .from(eventRegistrations)
          .where(eq(eventRegistrations.eventSlug, SLUG))
      ).map((r) => [r.userId, r.id]),
    );
  let regByUser = await loadRegs();

  type Account = (typeof allUsers)[number];
  const keyOf = (u: Account) =>
    nameKey([u.firstName, u.lastName].filter(Boolean).join(" ") || u.name);
  const isoDob = (u: Account) => u.dateOfBirth?.toISOString().slice(0, 10);
  /** runner name → account, deterministically or not at all. */
  const accountOf = new Map<string, { user: Account; why: string }>();
  for (const r of started) {
    const key = nameKey(r.name);
    let hits = allUsers.filter((u) => keyOf(u) === key);
    let why = "name";
    if (hits.length > 1) {
      const reg = hits.filter((u) => regByUser.has(u.id));
      if (reg.length === 1) {
        why += ` (${hits.length} accounts; the one registered)`;
        hits = reg;
      }
    }
    if (hits.length === 0 && r.dob) {
      const tokens = key.split(" ");
      hits = allUsers.filter(
        (u) =>
          isoDob(u) === r.dob &&
          keyOf(u)
            .split(" ")
            .some((t) => tokens.includes(t)),
      );
      why = "name token + DoB";
    }
    if (hits.length !== 1 && ALIASES[r.name]) {
      hits = allUsers.filter((u) => u.email === ALIASES[r.name]);
      why = "alias";
    }
    if (hits.length !== 1) {
      console.log(`  no unique account for ${r.name} (${hits.length} candidates) — unlinked, unpaid`);
      continue;
    }
    const dobNote =
      r.dob && isoDob(hits[0]) && isoDob(hits[0]) !== r.dob
        ? `  (DoB differs: file ${r.dob}, account ${isoDob(hits[0])})`
        : r.dob && isoDob(hits[0]) === r.dob
          ? "  (DoB confirms)"
          : "";
    accountOf.set(r.name, { user: hits[0], why: why + dobNote });
  }

  const toCreate = [...accountOf.entries()].filter(([, a]) => !regByUser.has(a.user.id));
  console.log(`\nRegistrations to create for runners who raced unregistered: ${toCreate.length}`);
  for (const [name, a] of toCreate) console.log(`  ${name} → ${a.user.email} by ${a.why}`);
  for (const [name, a] of [...accountOf.entries()].filter(([, a]) => regByUser.has(a.user.id))) {
    console.log(`  already registered: ${name} → ${a.user.email} by ${a.why}`);
  }

  if (WRITE && toCreate.length > 0) {
    const created = await db
      .insert(eventRegistrations)
      .values(
        toCreate.map(([, a]) => ({
          eventSlug: SLUG,
          userId: a.user.id,
          status: "confirmed" as const,
          confirmedAt: new Date(),
        })),
      )
      .onConflictDoNothing()
      .returning({ id: eventRegistrations.id });
    console.log(`Created ${created.length} registrations: ${created.map((c) => c.id).join(", ")}`);
    regByUser = await loadRegs();
  }

  // ── resolve + print the heat ───────────────────────────────────────
  const rows = await resolveRegistrations(SLUG, parsed.rows);
  for (const r of rows) {
    const a = accountOf.get(r.name);
    const registrationId = a ? regByUser.get(a.user.id) : undefined;
    if (!r.registrationId && registrationId) {
      r.registrationId = registrationId;
      r.matchedBy = "name";
    }
  }
  const heatNumbers = [...new Set(rows.map((r) => r.heat))].sort((a, b) => a - b);
  const unknown = await unknownHeatNumbers(SLUG, heatNumbers);
  console.log(`\nParsed ${rows.length} rows across heats ${heatNumbers.join(", ")}`);
  for (const r of rows
    .slice()
    .sort((a, b) => a.heat - b.heat || (a.place ?? Infinity) - (b.place ?? Infinity))) {
    console.log(
      `  heat ${r.heat}  bib ${String(r.bib).padStart(3)}  ` +
        `${r.status === "finished" ? `#${r.place} ${formatTime(r.timeCs as number)}` : r.status.toUpperCase()}  ` +
        `${r.name.padEnd(22)} (${r.gender})  splits:${r.splits?.length ?? 0}  ` +
        `[${r.matchedBy ?? "UNLINKED"}${r.registrationId || !accountOf.has(r.name) ? "" : " — registration after --write"}]`,
    );
  }
  const linked = rows.filter((r) => r.registrationId !== null).length;
  console.log(`Linked to registrations: ${linked}/${rows.length}`);
  if (unknown.length > 0) console.log(`Heats with no event_heats row: ${unknown.join(", ")}`);

  // ── participation: PARTICIPATION_REWARD_ACER to everyone who started ─
  const grants = started
    .filter((r) => accountOf.has(r.name))
    .map((r) => {
      const { user } = accountOf.get(r.name) as { user: Account };
      return { name: r.name, user, registrationId: regByUser.get(user.id) };
    });
  console.log(
    `\nParticipation: ${PARTICIPATION_REWARD_ACER} ACER × ${grants.length} runners who started with an account`,
  );
  for (const g of grants) {
    console.log(
      `  ${g.name.padEnd(22)} ${g.user.email}${g.registrationId ? "" : "  (registration after --write)"}`,
    );
  }
  const unpaid = started.filter((r) => !accountOf.has(r.name)).map((r) => r.name);
  console.log(`  not paid (no account): ${unpaid.join(", ") || "—"}`);

  if (!WRITE) {
    console.log("\nDry-run complete — nothing written. Re-run with --write to import.");
    process.exit(0);
  }

  const outcome = await replaceHeatResults(SLUG, rows);
  console.log(`\nImported ${outcome.rows} rows into ${outcome.heats} heat(s).`);

  let written = 0;
  let already = 0;
  for (const g of grants) {
    if (!g.registrationId) throw new Error(`no registration for ${g.name} after insert`);
    const row = await recordWalletTransaction({
      userId: g.user.id,
      asset: "ACER",
      amountMinor: acerToMinor(PARTICIPATION_REWARD_ACER),
      kind: "participation_reward",
      reference: `event:${SLUG}`,
      idempotencyKey: `participation:${g.registrationId}`,
    });
    if (row) written += 1;
    else already += 1;
  }
  console.log(`Paid ${written} participation rewards; ${already} already in the ledger (no-op).`);

  if (event.status !== "completed") {
    console.log(`Event status is "${event.status}" — set it to completed in admin.`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
