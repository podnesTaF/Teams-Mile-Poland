/**
 * One-off: publish the 28.10.2026 night (slug `mile-2026-10-24`, dated
 * 2026-10-28 — the slug predates the date move) from the timing operator's
 * three sheets, pay participation and close the event.
 *
 *   "Results per 200m"  — two BATTLES, AB Black Warsaw vs AB Red Warsaw, each
 *                         team 3 miles + 2 PACER/JOKER pairs, "Battle N"
 *                         banners, readings every 200 m. Published as heats 1
 *                         and 2 (the running order), team names mapped to the
 *                         platform teams of that colour. Team time = 3 miles +
 *                         2 JOKER finishes, checked against the file's figure.
 *   "Results by Heat"   — the individual mile ("Heat 1" banner), readings
 *                         every 100 m with lap rows; published as heat 3.
 *   "Results Ranking"   — the same individual mile ranked; cross-check only.
 *
 * The battle sheet prints a JOKER's five readings under the first five split
 * headers (9 m … 809 m); they are really 809 m … 1609 m (the last one is the
 * finish), so every JOKER split is moved +800 m and the finish checked.
 *
 * Accounts link deterministically or not at all (unique name key, DoB + name
 * token, or an explicit alias). A `confirmed` registration is created for
 * every account holder who raced unregistered; PARTICIPATION_REWARD_ACER goes
 * to every starter with an account under `participation:<registrationId>`.
 *
 *   npx tsx --env-file=.env.local scripts/import-1028-results.ts <battles.xlsx> <byheat.xlsx> <ranking.xlsx>
 *   npx tsx --env-file=.env.local scripts/import-1028-results.ts <battles.xlsx> <byheat.xlsx> <ranking.xlsx> --write
 */
import { readFileSync } from "node:fs";

import { eq } from "drizzle-orm";
import ExcelJS from "exceljs";

import { eventRegistrations, events, users } from "../src/db/schema";
import {
  replaceHeatResults,
  replaceTeamHeatResults,
  resolveRegistrations,
  resolveTeamResults,
} from "../src/features/admin/results-import/data";
import {
  mapHeaderRow,
  parseResultsFile,
  parseTimeCs,
  type ParsedResultRow,
} from "../src/features/admin/results-import/parse";
import { parseTeamGrid, type ParsedTeamRunner } from "../src/features/admin/results-import/parse-team";
import { COMPOSITION } from "../src/features/teams/rating-rules";
import { PARTICIPATION_REWARD_ACER, acerToMinor } from "../src/features/wallet/config";
import { recordWalletTransaction } from "../src/features/wallet/data";
import { getDb } from "../src/lib/db";
import { nameKey } from "../src/lib/events/name-key";
import { getEventBySlug } from "../src/lib/events/store";
import { formatTime } from "../src/lib/events/time";

const SLUG = "mile-2026-10-24";
/** The individual mile ran after both battles. */
const INDIVIDUAL_HEAT = 3;
/** Battle sheet team name → platform team. */
const TEAM_NAMES: Record<string, string> = {
  "AB Black Warsaw": "Ace Battle Mile BLACK Warsaw",
  "AB Red Warsaw": "Ace Battle Mile RED Warsaw",
};
/** Where a JOKER's readings really start: the sheet puts them under 9 m. */
const JOKER_SHIFT_M = 800;
const WRITE = process.argv.includes("--write");
const [battlesPath, byHeatPath, rankingPath] = process.argv.slice(2).filter((a) => !a.startsWith("--"));

/**
 * Timing-file name → account email, where no rule links them.
 * - PIDNEBESNYI Iurii: two accounts share his name and DoB; the registered one
 *   (RED roster) is podnes@gmail.com — the same choice as every team night.
 * - HALUNKA Volodymyr ↔ "Володимир Ігорович" (liooselio@gmail.com): the account
 *   holds first name + patronymic; DoB 30.04.1995 and sex match, registered for
 *   the night. Confirmed by the owner 2026-10-29.
 * - KOZLOVSKI Dominik: the battle sheet's spelling of KOZŁOWSKI Dominik (same
 *   DoB, same bib 23 in battle 1 and the individual mile).
 */
const ALIASES: Record<string, string> = {
  "PIDNEBESNYI Iurii": "podnes@gmail.com",
  "HALUNKA Volodymyr": "liooselio@gmail.com",
  "KOZLOVSKI Dominik": "strzala2003@onet.pl",
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

/** Grid → `;`-CSV buffer for parseResultsFile (cells never contain `;`). */
const toCsv = (grid: string[][]) =>
  Buffer.from(grid.map((r) => r.map((c) => c.replace(/;/g, ",")).join(";")).join("\n"), "utf8");

const figure = (r: ParsedTeamRunner) =>
  r.timeCs !== null
    ? formatTime(r.timeCs)
    : r.legTimeCs !== null
      ? `${formatTime(r.legTimeCs)} leg`
      : r.status;

async function main() {
  if (!battlesPath || !byHeatPath || !rankingPath) {
    console.error(
      "Usage: tsx scripts/import-1028-results.ts <battles.xlsx> <byheat.xlsx> <ranking.xlsx> [--write]",
    );
    process.exit(1);
  }
  const db = getDb();
  const host = new URL(process.env.DATABASE_URL ?? "postgres://unset/").hostname;
  console.log(`${WRITE ? "WRITE" : "dry-run"} against ${host}, event ${SLUG}`);

  const event = await getEventBySlug(SLUG);
  if (!event) throw new Error(`No event row for ${SLUG}`);
  console.log(`Event: ${event.name ?? SLUG} (${event.date}) — status "${event.status}"`);

  // ── individual mile: by-heat sheet, one "Heat 1" banner ────────────
  const byHeat = await xlsxToGrid(readFileSync(byHeatPath));
  const header = byHeat[0];
  const map = mapHeaderRow(header);
  const splitIdx = header
    .map((c, i) => (/^\d+ m$/i.test(c.trim()) ? i : -1))
    .filter((i) => i >= 0);
  const relabelled: string[][] = [header];
  let lapFaults = 0;
  for (let i = 1; i < byHeat.length; i += 1) {
    const row = byHeat[i];
    const filled = row.filter((c) => c.trim());
    if (filled.length === 1) {
      if (!/^heat\s*1$/i.test(filled[0].trim())) {
        throw new Error(`Unknown banner "${filled[0]}" on row ${i + 1}`);
      }
      relabelled.push([`Heat-${INDIVIDUAL_HEAT}`]);
      continue;
    }
    relabelled.push(row);
    // A runner row is followed by its lap row: reading[k] − reading[k−1] must
    // equal the printed lap under reading[k]. A DNS row has neither.
    const name = row[map.name as number]?.trim();
    if (name && parseTimeCs(row[splitIdx[0]] ?? "") !== null) {
      const laps = byHeat[i + 1] ?? [];
      const readings = splitIdx.map((c) => parseTimeCs(row[c] ?? ""));
      for (let k = 1; k < splitIdx.length; k += 1) {
        const lap = parseTimeCs(laps[splitIdx[k]] ?? "");
        const a = readings[k - 1];
        const b = readings[k];
        if (lap === null || a === null || b === null || b - a !== lap) {
          lapFaults += 1;
          console.log(
            `  LAP MISMATCH ${name} at ${header[splitIdx[k]]}: ` +
              `${b !== null && a !== null ? b - a : "?"} cs vs printed ${lap ?? "?"} cs`,
          );
        }
      }
    }
  }
  const parsed = await parseResultsFile("by-heat.csv", toCsv(relabelled));
  for (const e of parsed.errors) console.log(`  parser refused row ${e.sourceRow}: ${e.message}`);
  if (parsed.rows.length === 0) throw new Error("No parseable individual rows.");
  console.log(
    `By-heat: ${parsed.rows.length} rows, lap check ${lapFaults === 0 ? "clean" : `${lapFaults} faults`}`,
  );

  // ── cross-check against the ranking sheet ──────────────────────────
  const ranking = await xlsxToGrid(readFileSync(rankingPath));
  const rmap = mapHeaderRow(ranking[0]);
  const resultCol = ranking[0].findIndex((c) => /^result$/i.test(c.trim()));
  const rankByKey = new Map<string, string>();
  for (const row of ranking.slice(1)) {
    const name = row[rmap.name as number]?.trim();
    const bib = row[rmap.bib as number]?.trim();
    if (name && bib) rankByKey.set(`${bib}:${name}`, (row[resultCol] ?? "").trim());
  }
  let rankFaults = 0;
  for (const r of parsed.rows) {
    const cell = rankByKey.get(`${r.bib}:${r.name}`);
    const agrees =
      cell !== undefined &&
      (r.status === "finished" ? parseTimeCs(cell) === r.timeCs : cell.toLowerCase() === r.status);
    if (!agrees) {
      rankFaults += 1;
      console.log(`  RANKING MISMATCH bib ${r.bib} ${r.name}: by-heat ${r.timeCs ?? r.status}, ranking ${cell}`);
    }
  }
  if (rankByKey.size !== parsed.rows.length) rankFaults += 1;
  console.log(
    `Ranking sheet: ${rankByKey.size} rows, ${rankFaults === 0 ? "all agree" : `${rankFaults} disagree`}`,
  );
  if (lapFaults || rankFaults) throw new Error("Sheets disagree — not importing.");

  // ── battles: "Battle N" → heat N, sheet team names → platform teams ─
  const battleGrid = await xlsxToGrid(readFileSync(battlesPath));
  const bheader = battleGrid[0];
  const bmap = mapHeaderRow(bheader);
  const battleRows: string[][] = [bheader];
  for (const row of battleGrid.slice(1)) {
    const filled = row.filter((c) => c.trim());
    if (filled.length === 0) continue;
    const banner = filled.length === 1 ? /^battle\s*(\d+)$/i.exec(filled[0].trim()) : null;
    if (filled.length === 1 && !banner) throw new Error(`Unknown banner "${filled[0]}"`);
    if (banner) {
      battleRows.push([banner[1]]);
      continue;
    }
    const sheetName = row[bmap.name as number]?.trim() ?? "";
    if (TEAM_NAMES[sheetName]) {
      const renamed = [...row];
      renamed[bmap.name as number] = TEAM_NAMES[sheetName];
      battleRows.push(renamed);
      continue;
    }
    battleRows.push(row);
  }
  const bparsed = parseTeamGrid(battleRows, 0, bmap);
  for (const e of bparsed.errors) console.log(`  battle parser refused row ${e.sourceRow}: ${e.message}`);
  if (bparsed.errors.length > 0) throw new Error("Battle sheet has unparseable rows.");
  const unknownTeam = bparsed.teams.find((t) => !Object.values(TEAM_NAMES).includes(t.name));
  if (unknownTeam) throw new Error(`Unmapped team "${unknownTeam.name}"`);

  const rules = COMPOSITION.men;
  let battleFaults = 0;
  const fault = (msg: string) => {
    battleFaults += 1;
    console.log(`  BATTLE FAULT ${msg}`);
  };
  for (const team of bparsed.teams) {
    const label = `heat ${team.heat} ${team.name}`;
    for (const r of team.runners) {
      if (r.role !== "joker" || !r.splits) continue;
      r.splits = r.splits.map((s) => ({ m: s.m + JOKER_SHIFT_M, cs: s.cs }));
      const last = r.splits.at(-1);
      if (last?.m !== 1609 || last.cs !== r.legTimeCs) {
        fault(`${label} ${r.name}: last joker reading ${last?.m} m ${last?.cs} ≠ finish ${r.legTimeCs}`);
      }
      const ace = team.runners.find((a) => a.role === "ace" && a.pairNo === r.pairNo);
      if (!ace?.legTimeCs || r.splits[0].cs <= ace.legTimeCs) {
        fault(`${label} ${r.name}: first reading not after pair ${r.pairNo} handover`);
      }
    }
    const racers = team.runners.filter((r) => r.role === "racer");
    const jokers = team.runners.filter((r) => r.role === "joker");
    const aces = team.runners.filter((r) => r.role === "ace");
    if (racers.length !== rules.racers || jokers.length !== rules.pairs || aces.length !== rules.pairs) {
      fault(`${label}: ${racers.length} racers / ${aces.length} pacers / ${jokers.length} jokers`);
    }
    if (team.runners.some((r) => r.status !== "finished")) fault(`${label}: a runner did not finish`);
    const sum =
      racers.reduce((s, r) => s + (r.timeCs ?? 0), 0) + jokers.reduce((s, r) => s + (r.legTimeCs ?? 0), 0);
    if (sum !== team.timeCs) {
      fault(`${label}: 3 miles + 2 jokers = ${formatTime(sum)}, sheet says ${team.timeCs}`);
    }
  }
  for (const heat of new Set(bparsed.teams.map((t) => t.heat))) {
    const two = bparsed.teams.filter((t) => t.heat === heat);
    const ordered = [...two].sort((a, b) => (a.timeCs ?? 0) - (b.timeCs ?? 0));
    if (two.length !== 2 || ordered.some((t, i) => t.place !== i + 1)) {
      fault(`battle ${heat}: expected 2 teams placed by time`);
    }
  }
  if (battleFaults) throw new Error("Battle sheet does not add up — not importing.");
  console.log(`Battles: ${bparsed.teams.length} team runs, team times and joker splits check out`);

  // ── accounts and registrations for everyone who started ───────────
  type Starter = { name: string; dob: string | null };
  const starters = new Map<string, Starter>();
  for (const r of parsed.rows.filter((r) => r.status !== "dns")) starters.set(r.name, r);
  for (const r of bparsed.teams.flatMap((t) => t.runners)) {
    if (!starters.has(r.name)) starters.set(r.name, r);
  }
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
  const accountOf = new Map<string, { user: Account; why: string }>();
  const resolveAccount = (name: string, dob: string | null) => {
    const key = nameKey(name);
    let hits = allUsers.filter((u) => keyOf(u) === key);
    let why = "name";
    if (hits.length > 1) {
      const reg = hits.filter((u) => regByUser.has(u.id));
      if (reg.length === 1) {
        why += ` (${hits.length} accounts; the one registered)`;
        hits = reg;
      }
    }
    if (hits.length === 0 && dob) {
      const tokens = key.split(" ");
      hits = allUsers.filter(
        (u) => isoDob(u) === dob && keyOf(u).split(" ").some((t) => tokens.includes(t)),
      );
      why = "name token + DoB";
    }
    if (hits.length !== 1 && ALIASES[name]) {
      hits = allUsers.filter((u) => u.email === ALIASES[name]);
      why = "alias";
    }
    if (hits.length !== 1) return null;
    const dobNote =
      dob && isoDob(hits[0]) && isoDob(hits[0]) !== dob
        ? `  (DoB differs: file ${dob}, account ${isoDob(hits[0])})`
        : dob && isoDob(hits[0]) === dob
          ? "  (DoB confirms)"
          : "";
    return { user: hits[0], why: why + dobNote };
  };
  console.log("");
  for (const s of starters.values()) {
    const a = resolveAccount(s.name, s.dob);
    if (!a) {
      console.log(`  no unique account for ${s.name} — unlinked, unpaid`);
      continue;
    }
    accountOf.set(s.name, a);
  }
  // The individual DNS row still links (Telkovsky raced the battles).
  for (const r of parsed.rows) {
    if (!accountOf.has(r.name)) {
      const a = resolveAccount(r.name, r.dob);
      if (a) accountOf.set(r.name, a);
    }
  }

  const byUser = new Map<string, { names: string[]; a: { user: Account; why: string } }>();
  for (const [name, a] of accountOf) {
    if (!starters.has(name)) continue;
    const e = byUser.get(a.user.id) ?? { names: [], a };
    e.names.push(name);
    byUser.set(a.user.id, e);
  }
  const toCreate = [...byUser.values()].filter(({ a }) => !regByUser.has(a.user.id));
  console.log(`Registrations to create for runners who raced unregistered: ${toCreate.length}`);
  for (const { names, a } of toCreate) console.log(`  ${names.join(" / ")} → ${a.user.email} by ${a.why}`);
  for (const { names, a } of [...byUser.values()].filter(({ a }) => regByUser.has(a.user.id))) {
    console.log(`  already registered: ${names.join(" / ")} → ${a.user.email} by ${a.why}`);
  }

  if (WRITE && toCreate.length > 0) {
    const created = await db
      .insert(eventRegistrations)
      .values(
        toCreate.map(({ a }) => ({
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

  // ── resolve + print ────────────────────────────────────────────────
  const link = (r: { name: string; registrationId: string | null; matchedBy: string | null }) => {
    const a = accountOf.get(r.name);
    const registrationId = a ? regByUser.get(a.user.id) : undefined;
    if (!r.registrationId && registrationId) {
      r.registrationId = registrationId;
      r.matchedBy = "name";
    }
  };
  const resolvedTeams = await resolveTeamResults(SLUG, bparsed.teams);
  for (const team of resolvedTeams) {
    team.runners.forEach(link);
    console.log(
      `\nBattle ${team.heat}  #${team.place}  ${team.name}  ${formatTime(team.timeCs as number)}  ` +
        `[team ${team.teamId ? `linked ${team.teamId}` : "UNLINKED"}]`,
    );
    for (const r of team.runners) {
      console.log(
        `    ${String(r.bib ?? "—").padStart(3)}  ${(r.role + (r.pairNo ?? "")).padEnd(7)} ${figure(r).padEnd(14)} ` +
          `${r.name.padEnd(22)} splits:${r.splits?.map((s) => s.m).join(",") ?? "—"}  [${r.matchedBy ?? "UNLINKED"}]`,
      );
    }
  }
  const teamRunners = resolvedTeams.flatMap((t) => t.runners);
  console.log(`Linked battle runners: ${teamRunners.filter((r) => r.registrationId).length}/${teamRunners.length}`);

  const rows = await resolveRegistrations(SLUG, parsed.rows as ParsedResultRow[]);
  rows.forEach(link);
  console.log(`\nIndividual mile (heat ${INDIVIDUAL_HEAT}, ${rows.length} rows):`);
  for (const r of rows.slice().sort((a, b) => (a.place ?? 99) - (b.place ?? 99))) {
    console.log(
      `  bib ${String(r.bib).padStart(3)}  ` +
        `${r.status === "finished" ? `#${r.place} ${formatTime(r.timeCs as number)}` : r.status.toUpperCase()}  ` +
        `${r.name.padEnd(22)} splits:${r.splits?.length ?? 0}  [${r.matchedBy ?? "UNLINKED"}]`,
    );
  }
  console.log(`Linked: ${rows.filter((r) => r.registrationId).length}/${rows.length}`);

  // ── participation ──────────────────────────────────────────────────
  const grants = [...byUser.values()].map(({ names, a }) => ({
    names,
    user: a.user,
    registrationId: regByUser.get(a.user.id),
  }));
  console.log(`\nParticipation: ${PARTICIPATION_REWARD_ACER} ACER × ${grants.length} starters with an account`);
  for (const g of grants) {
    console.log(
      `  ${g.names.join(" / ").padEnd(40)} ${g.user.email}${g.registrationId ? "" : "  (registration after --write)"}`,
    );
  }
  const unpaid = [...starters.values()].filter((s) => !accountOf.has(s.name)).map((s) => s.name);
  console.log(`  not paid (no account): ${unpaid.join(", ") || "—"}`);

  if (!WRITE) {
    console.log("\nDry-run complete — nothing written. Re-run with --write to import.");
    process.exit(0);
  }

  const ind = await replaceHeatResults(SLUG, rows);
  console.log(`\nImported ${ind.rows} individual rows into ${ind.heats} heat.`);
  const tm = await replaceTeamHeatResults(SLUG, resolvedTeams);
  console.log(`Imported ${tm.teams} team runs, ${tm.rows} runner rows, ${tm.heats} heats.`);

  let written = 0;
  let already = 0;
  for (const g of grants) {
    if (!g.registrationId) throw new Error(`no registration for ${g.names[0]} after insert`);
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
