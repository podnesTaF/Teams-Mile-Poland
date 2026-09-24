/**
 * One-off: import the 22.09.2026 team timing export into mile-2026-09-22 and
 * close the night (status → completed). Same parse → resolve → per-heat
 * replace path as the admin Results tab, plus the one step the tab does not
 * do: a runner who raced for a team but never registered for the night (the
 * teams were formed on the spot, no platform team entries exist) gets an
 * `event_registrations` row for their account, so the result reaches their
 * profile — accounts resolved deterministically or not at all:
 *
 *   1. a unique account by name key;
 *   2. a unique account with the file's date of birth sharing a name token;
 *   3. several candidates → the one who is on the platform team they raced
 *      for (two "Iurii Pidnebesnyi" accounts, same DoB; only one is on the
 *      AB Praga-Poludnie roster);
 *   4. the explicit ALIASES below, each with its evidence;
 *   5. otherwise left unlinked.
 *
 *   npx tsx --env-file=.env.local scripts/import-0922-results.ts <file.xlsx>
 *   npx tsx --env-file=.env.local scripts/import-0922-results.ts <file.xlsx> --write
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { eq } from "drizzle-orm";

import { eventRegistrations, events, userTeamMembers, users } from "../src/db/schema";
import {
  replaceTeamHeatResults,
  resolveTeamResults,
} from "../src/features/admin/results-import/data";
import { parseResultsFile } from "../src/features/admin/results-import/parse";
import { getDb } from "../src/lib/db";
import { nameKey } from "../src/lib/events/name-key";
import { getEventBySlug } from "../src/lib/events/store";
import { formatTime } from "../src/lib/events/time";

const SLUG = "mile-2026-09-22";
const WRITE = process.argv.includes("--write");
const filePath = process.argv[2];

/**
 * Timing-file name → account email, where no rule above links them.
 * ZUGAY Mikhal ↔ Michał Zugaj: same DoB (03.04.1992), same sex, the timing
 * operator transliterated the surname.
 */
const ALIASES: Record<string, string> = {
  "ZUGAY Mikhal": "zugajmichal92@gmail.com",
};

async function main() {
  if (!filePath || filePath.startsWith("--")) {
    console.error("Usage: tsx scripts/import-0922-results.ts <results file> [--write]");
    process.exit(1);
  }
  const db = getDb();
  const host = new URL(process.env.DATABASE_URL ?? "postgres://unset/").hostname;
  console.log(`${WRITE ? "WRITE" : "dry-run"} against ${host}, event ${SLUG}`);

  const event = await getEventBySlug(SLUG);
  if (!event) throw new Error(`No event row for ${SLUG}`);
  console.log(`Event: ${event.name} — status "${event.status}"`);

  const parsed = await parseResultsFile(basename(filePath), readFileSync(filePath));
  for (const e of parsed.errors) console.log(`  parser refused row ${e.sourceRow}: ${e.message}`);
  if (parsed.teams.length === 0) throw new Error("Not a team file — no teams parsed.");

  // ── accounts for runners with no registration on the night ──────────
  let teams = await resolveTeamResults(SLUG, parsed.teams);
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
  const members = await db
    .select({ teamId: userTeamMembers.teamId, userId: userTeamMembers.userId })
    .from(userTeamMembers);
  const registered = new Set(
    (
      await db
        .select({ userId: eventRegistrations.userId })
        .from(eventRegistrations)
        .where(eq(eventRegistrations.eventSlug, SLUG))
    ).map((r) => r.userId),
  );

  const keyOf = (u: (typeof allUsers)[number]) =>
    nameKey([u.firstName, u.lastName].filter(Boolean).join(" ") || u.name);
  const toCreate = new Map<string, { userId: string; why: string }>();
  for (const team of teams) {
    for (const r of team.runners) {
      if (r.registrationId) continue;
      const key = nameKey(r.name);
      let hits = allUsers.filter((u) => keyOf(u) === key);
      let why = "name";
      if (hits.length === 0 && r.dob) {
        const tokens = key.split(" ");
        hits = allUsers.filter(
          (u) =>
            u.dateOfBirth?.toISOString().slice(0, 10) === r.dob &&
            keyOf(u)
              .split(" ")
              .some((t) => tokens.includes(t)),
        );
        why = "name token + DoB";
      }
      if (hits.length > 1 && team.teamId) {
        const onTeam = hits.filter((u) =>
          members.some((m) => m.teamId === team.teamId && m.userId === u.id),
        );
        if (onTeam.length === 1) {
          why += ` (${hits.length} accounts; the one on ${team.name})`;
          hits = onTeam;
        }
      }
      if (hits.length !== 1 && ALIASES[r.name]) {
        hits = allUsers.filter((u) => u.email === ALIASES[r.name]);
        why = "alias";
      }
      if (hits.length !== 1) {
        console.log(`  no unique account for ${r.name} (${hits.length} candidates) — stays unlinked`);
        continue;
      }
      if (registered.has(hits[0].id)) continue;
      toCreate.set(hits[0].id, { userId: hits[0].id, why: `${r.name} → ${hits[0].email} by ${why}` });
    }
  }
  console.log(`\nRegistrations to create for runners who raced unregistered: ${toCreate.size}`);
  for (const c of toCreate.values()) console.log(`  ${c.why}`);

  if (WRITE && toCreate.size > 0) {
    const created = await db
      .insert(eventRegistrations)
      .values(
        [...toCreate.values()].map((c) => ({
          eventSlug: SLUG,
          userId: c.userId,
          status: "confirmed" as const,
          confirmedAt: new Date(),
        })),
      )
      .onConflictDoNothing()
      .returning({ id: eventRegistrations.id, userId: eventRegistrations.userId });
    console.log(`Created ${created.length} registrations: ${created.map((c) => c.id).join(", ")}`);
  }

  // Re-resolve: the new registrations (and aliases) now link through the roster.
  // In a dry run those rows do not exist yet, so the runners listed above show
  // as UNLINKED below; after --write they link by name (or DoB).
  teams = await resolveTeamResults(SLUG, parsed.teams);
  // An alias never resolves through the roster (that is why it is an alias),
  // so link it to that account's registration on the night explicitly.
  const regByUser = new Map(
    (
      await db
        .select({ id: eventRegistrations.id, userId: eventRegistrations.userId })
        .from(eventRegistrations)
        .where(eq(eventRegistrations.eventSlug, SLUG))
    ).map((r) => [r.userId, r.id]),
  );
  for (const r of teams.flatMap((t) => t.runners)) {
    const email = ALIASES[r.name];
    const user = email ? allUsers.find((u) => u.email === email) : undefined;
    const registrationId = user ? regByUser.get(user.id) : undefined;
    if (!r.registrationId && registrationId) {
      r.registrationId = registrationId;
      r.matchedBy = "name";
    }
  }

  console.log("");
  for (const t of teams) {
    console.log(
      `Heat ${t.heat}  #${t.place ?? "—"}  ${t.name}  ${t.timeCs === null ? t.status : formatTime(t.timeCs)}  ` +
        `[team ${t.teamId ? "linked" : "UNLINKED"}]`,
    );
    for (const r of t.runners) {
      const time =
        r.timeCs !== null ? formatTime(r.timeCs) : r.legTimeCs !== null ? `${formatTime(r.legTimeCs)} leg` : r.status;
      console.log(
        `    ${String(r.bib ?? "—").padStart(3)}  ${(r.role + (r.pairNo ?? "")).padEnd(6)} ${time.padEnd(14)} ` +
          `${r.name.padEnd(24)} splits:${r.splits?.length ?? 0}  [${r.matchedBy ?? "UNLINKED"}]`,
      );
    }
  }
  const runners = teams.flatMap((t) => t.runners);
  console.log(`\nLinked runners: ${runners.filter((r) => r.registrationId).length}/${runners.length}`);

  if (!WRITE) {
    console.log("\nDry-run complete — nothing written. Re-run with --write to import.");
    process.exit(0);
  }

  const outcome = await replaceTeamHeatResults(SLUG, teams);
  console.log(`\nImported ${outcome.teams} team runs, ${outcome.rows} runner rows, ${outcome.heats} heats.`);

  if (event.status !== "completed") {
    await db
      .update(events)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(events.slug, SLUG));
    console.log(`Event status: "${event.status}" → "completed".`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
