/**
 * One-off: publish the 01.10.2026 night (mile-2026-10-01) from the timing
 * operator's sheet and pay participation.
 *
 * The sheet is one flat list — no heat banner, no team rows: four runners ran
 * a plain mile, four ACE+JOKER pairs ran the relay, all in one group. The
 * owner's instruction (2026-10-03): publish it as **one team run** made of the
 * three best miles and the two best pairs — exactly a men's composition
 * (`COMPOSITION.men` = 3 RACERS + 2 pairs) — scored like 22.09 (ADR 0014):
 * team time = plain sum of the three miles and the two pairs' miles, no
 * penalty. An ACE never runs the full distance and still gets their row
 * (`leg_time_cs` = handover reading), as on 22.09. Runners outside the
 * selection are not published but still count as participants.
 *
 * Then, for every runner who started (not DNS) and has an account on the
 * platform: an `event_registrations` row if they raced unregistered (same
 * rule set as 22.09 — unique name key, DoB + name token, explicit alias, or
 * left alone), and PARTICIPATION_REWARD_ACER under the canonical key
 * `participation:<registrationId>`, so the check-in accrual and the
 * participation backfill cannot pay the night twice.
 *
 *   npx tsx --env-file=.env.local scripts/import-1001-results.ts <file.xlsx>
 *   npx tsx --env-file=.env.local scripts/import-1001-results.ts <file.xlsx> --write
 */
import { readFileSync } from "node:fs";

import { eq } from "drizzle-orm";
import ExcelJS from "exceljs";

import { eventRegistrations, users } from "../src/db/schema";
import {
  replaceTeamHeatResults,
  resolveTeamResults,
} from "../src/features/admin/results-import/data";
import { mapHeaderRow } from "../src/features/admin/results-import/parse";
import {
  parseTeamGrid,
  type ParsedTeam,
  type ParsedTeamRunner,
} from "../src/features/admin/results-import/parse-team";
import { COMPOSITION } from "../src/features/teams/rating-rules";
import { PARTICIPATION_REWARD_ACER, acerToMinor } from "../src/features/wallet/config";
import { recordWalletTransaction } from "../src/features/wallet/data";
import { getDb } from "../src/lib/db";
import { nameKey } from "../src/lib/events/name-key";
import { getEventBySlug } from "../src/lib/events/store";
import { formatTime } from "../src/lib/events/time";

const SLUG = "mile-2026-10-01";
const HEAT = 1;
/** Owner (2026-10-03): the run counts for the platform team AB Wilanów; resolveTeamResults links it by name. */
const TEAM_NAME = "AB Wilanów";
const WRITE = process.argv.includes("--write");
const filePath = process.argv[2];

/**
 * Timing-file name → account email, where no rule links them.
 * POLAZSEK Antek ↔ Antoni Polaszek: transposed letters plus a diminutive; the
 * only Polaszek account, on the AB Praga-Poludnie roster, linked as
 * "POLASZEK Antoni" on 22.09. The sheet's DoB (01.01.2007) is a placeholder —
 * SKUP carries 01.01.1985 the same way against an account DoB of 06.08.1985.
 */
const ALIASES: Record<string, string> = {
  "POLAZSEK Antek": "katalonia13x@gmail.com",
};

async function xlsxToGrid(buffer: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  const grid: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const v = cell.value;
      let text = "";
      if (v !== null && v !== undefined) {
        if (typeof v !== "object") text = String(v);
        else if ("richText" in v) text = v.richText.map((r) => r.text).join("");
        else if ("text" in v) text = String(v.text);
        else if ("result" in v) text = String(v.result ?? "");
      }
      cells[colNumber - 1] = text;
    });
    grid[rowNumber - 1] = cells.map((c) => c ?? "");
  });
  return grid.map((row) => row ?? []);
}

const legOf = (r: ParsedTeamRunner | undefined) => r?.legTimeCs as number;

async function main() {
  if (!filePath || filePath.startsWith("--")) {
    console.error("Usage: tsx scripts/import-1001-results.ts <results file> [--write]");
    process.exit(1);
  }
  const db = getDb();
  const host = new URL(process.env.DATABASE_URL ?? "postgres://unset/").hostname;
  console.log(`${WRITE ? "WRITE" : "dry-run"} against ${host}, event ${SLUG}`);

  const event = await getEventBySlug(SLUG);
  if (!event) throw new Error(`No event row for ${SLUG}`);
  console.log(`Event: ${event.name} — status "${event.status}"`);

  // ── read the flat sheet through the team parser ────────────────────
  // The sheet has the team layout's columns but no banner and no team row;
  // give it one of each so every runner parses into a role/leg/mile.
  const grid = await xlsxToGrid(readFileSync(filePath));
  const header = grid[0];
  const map = mapHeaderRow(header);
  const parsed = parseTeamGrid(
    [header, [String(HEAT)], ["1", "ALL", "0.00"], ...grid.slice(1)],
    0,
    map,
  );
  for (const e of parsed.errors) console.log(`  parser refused row ${e.sourceRow}: ${e.message}`);
  const all = parsed.teams[0]?.runners ?? [];
  if (all.length === 0) throw new Error("No runner rows parsed.");
  // The sheet writes the runner's *last* reading into Result, so a RACER who
  // stopped at 409 m arrives looking like a 1:23 mile. A mile ends at the
  // 1609 m mat: no reading there, no mile — DNF, splits kept.
  const MILE_M = 1609;
  for (const r of all) {
    const reachedLine = r.splits?.some((s) => s.m >= MILE_M) ?? true;
    if (r.role !== "ace" && r.status === "finished" && !reachedLine) {
      console.log(`  ${r.name}: last reading ${r.splits?.at(-1)?.m ?? "?"} m, not ${MILE_M} m — DNF`);
      r.status = "dnf";
      r.timeCs = null;
      r.legTimeCs = null;
    }
  }

  // ── the selection: best 3 miles + best 2 pairs ─────────────────────
  const rules = COMPOSITION.men;
  const racers = all
    .filter((r) => r.role === "racer" && r.status === "finished" && r.timeCs !== null)
    .sort((a, b) => (a.timeCs as number) - (b.timeCs as number))
    .slice(0, rules.racers);
  const pairNos = [...new Set(all.filter((r) => r.pairNo !== null).map((r) => r.pairNo as number))];
  const pairs = pairNos
    .map((no) => ({
      no,
      ace: all.find((r) => r.pairNo === no && r.role === "ace"),
      joker: all.find((r) => r.pairNo === no && r.role === "joker"),
    }))
    .filter((p) => p.joker?.status === "finished" && p.joker.legTimeCs !== null && p.ace)
    .sort((a, b) => legOf(a.joker) - legOf(b.joker))
    .slice(0, rules.pairs);
  if (racers.length !== rules.racers || pairs.length !== rules.pairs) {
    throw new Error(
      `Need ${rules.racers} miles + ${rules.pairs} pairs; have ${racers.length} + ${pairs.length}`,
    );
  }
  // Pairs are renumbered by rank (fastest = 1): `pairNo` is 1 or 2 in the schema.
  const selected: ParsedTeamRunner[] = [
    ...racers,
    ...pairs.flatMap((p, i) => [
      { ...(p.ace as ParsedTeamRunner), pairNo: i + 1 },
      { ...(p.joker as ParsedTeamRunner), pairNo: i + 1 },
    ]),
  ];
  const selectedNames = new Set(selected.map((r) => r.name));
  const timeCs =
    racers.reduce((s, r) => s + (r.timeCs as number), 0) +
    pairs.reduce((s, p) => s + legOf(p.joker), 0);
  const team: ParsedTeam = {
    sourceRow: 0,
    heat: HEAT,
    name: TEAM_NAME,
    status: "finished",
    place: 1,
    timeCs,
    runners: selected,
  };
  const figure = (r: ParsedTeamRunner) =>
    r.timeCs !== null
      ? formatTime(r.timeCs)
      : r.legTimeCs !== null
        ? `${formatTime(r.legTimeCs)} leg`
        : r.status;
  console.log(`\nNot published (outside the 3+2 selection):`);
  for (const r of all.filter((r) => !selectedNames.has(r.name))) {
    console.log(`    ${(r.role + (r.pairNo ?? "")).padEnd(6)} ${figure(r).padEnd(14)} ${r.name}`);
  }

  // ── accounts and registrations for everyone who started ───────────
  const started = all.filter((r) => r.status !== "dns");
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
  /** runner name → account, deterministically or not at all. */
  const accountOf = new Map<string, { user: Account; why: string }>();
  for (const r of started) {
    const key = nameKey(r.name);
    let hits = allUsers.filter((u) => keyOf(u) === key);
    let why = "name";
    // Several accounts with the name → the one registered for the night.
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
          u.dateOfBirth?.toISOString().slice(0, 10) === r.dob &&
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
    accountOf.set(r.name, { user: hits[0], why });
  }

  const toCreate = [...accountOf.entries()].filter(([, a]) => !regByUser.has(a.user.id));
  console.log(`\nRegistrations to create for runners who raced unregistered: ${toCreate.length}`);
  for (const [name, a] of toCreate) console.log(`  ${name} → ${a.user.email} by ${a.why}`);

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

  // ── resolve + print the team ───────────────────────────────────────
  const [resolved] = await resolveTeamResults(SLUG, [team]);
  for (const r of resolved.runners) {
    const a = accountOf.get(r.name);
    const registrationId = a ? regByUser.get(a.user.id) : undefined;
    if (!r.registrationId && registrationId) {
      r.registrationId = registrationId;
      r.matchedBy = "name";
    }
  }
  console.log(
    `\nHeat ${resolved.heat}  #${resolved.place}  ${resolved.name}  ${formatTime(resolved.timeCs as number)}  ` +
      `[team ${resolved.teamId ? "linked" : "UNLINKED (pick-up team)"}]`,
  );
  for (const r of resolved.runners) {
    console.log(
      `    ${String(r.bib ?? "—").padStart(3)}  ${(r.role + (r.pairNo ?? "")).padEnd(6)} ${figure(r).padEnd(14)} ` +
        `${r.name.padEnd(24)} splits:${r.splits?.length ?? 0}  [${r.matchedBy ?? "UNLINKED"}]`,
    );
  }
  console.log(
    `Linked runners: ${resolved.runners.filter((r) => r.registrationId).length}/${resolved.runners.length}`,
  );

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
  const dns = all.filter((r) => r.status === "dns").map((r) => r.name);
  console.log(`  not paid (no account): ${unpaid.join(", ") || "—"}; DNS: ${dns.join(", ") || "—"}`);

  if (!WRITE) {
    console.log("\nDry-run complete — nothing written. Re-run with --write to import.");
    process.exit(0);
  }

  const outcome = await replaceTeamHeatResults(SLUG, [resolved]);
  console.log(`\nImported ${outcome.teams} team run, ${outcome.rows} runner rows, ${outcome.heats} heat.`);

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
