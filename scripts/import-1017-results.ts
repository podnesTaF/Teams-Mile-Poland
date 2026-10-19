/**
 * One-off: publish the 17.10.2026 night (mile-2026-10-17) from the timing
 * operator's three sheets, pay participation and close the event.
 *
 *   "Results by Heat"             — the individual miles with splits, grouped
 *                                   under two banners named after the teams
 *                                   ("ABR Black Warsaw", "ABR Red Warsaw");
 *                                   published as heats 2 and 3 in that order
 *                                   (heat 1 is the team run, as on 01.10).
 *   "Results Ranking"             — the same 15 miles ranked across both
 *                                   groups; used only to cross-check times.
 *   "Results by AB Black Warsawa" — one team run ("1" banner, no team row):
 *                                   3 miles + 4 ACE/JOKER pairs. Published the
 *                                   way the owner ruled for the same shape on
 *                                   01.10: best 3 miles + best 2 pairs (men's
 *                                   composition), team time = plain sum, pairs
 *                                   renumbered by rank, linked to the platform
 *                                   team the file is named after (BLACK).
 *
 * Every split is checked against the lap times the by-heat sheet prints under
 * each runner. Accounts link deterministically or not at all (unique name key,
 * DoB + name token, or an explicit alias). A `confirmed` registration is created
 * for every account holder who raced unregistered; PARTICIPATION_REWARD_ACER
 * goes to every starter with an account under `participation:<registrationId>`.
 *
 *   npx tsx --env-file=.env.local scripts/import-1017-results.ts <byheat.xlsx> <team.xlsx> <ranking.xlsx>
 *   npx tsx --env-file=.env.local scripts/import-1017-results.ts <byheat.xlsx> <team.xlsx> <ranking.xlsx> --write
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

const SLUG = "mile-2026-10-17";
const TEAM_HEAT = 1;
/** By-heat group banner → heat number. */
const GROUP_HEATS: Record<string, number> = {
  "ABR Black Warsaw": 2,
  "ABR Red Warsaw": 3,
};
/** The file is "Results by AB Black Warsawa"; the platform team of that colour. */
const TEAM_NAME = "Ace Battle Mile BLACK Warsaw";
const WRITE = process.argv.includes("--write");
const [byHeatPath, teamPath, rankingPath] = process.argv.slice(2).filter((a) => !a.startsWith("--"));

/**
 * Timing-file name → account email, where no rule links them.
 * - PODNEBESNYI / PODENBESNII Iurii: two spellings of Iurii Pidnebesnyi; two
 *   accounts share his name and DoB, the registered one (RED roster) is
 *   podnes@gmail.com — the same choice as on 22.09, 01.10 and 10.10.
 * - YAHIRSKYI Volodymyr ↔ Volodymyr Yahirskiy (vovarik52@gmail.com): one
 *   letter of transliteration; registered and paid for the night, DoB matches.
 */
const ALIASES: Record<string, string> = {
  "PODNEBESNYI Iurii": "podnes@gmail.com",
  "PODENBESNII Iurii": "podnes@gmail.com",
  "YAHIRSKYI Volodymyr": "vovarik52@gmail.com",
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

const legOf = (r: ParsedTeamRunner | undefined) => r?.legTimeCs as number;
const figure = (r: ParsedTeamRunner) =>
  r.timeCs !== null
    ? formatTime(r.timeCs)
    : r.legTimeCs !== null
      ? `${formatTime(r.legTimeCs)} leg`
      : r.status;

async function main() {
  if (!byHeatPath || !teamPath || !rankingPath) {
    console.error(
      "Usage: tsx scripts/import-1017-results.ts <byheat.xlsx> <team.xlsx> <ranking.xlsx> [--write]",
    );
    process.exit(1);
  }
  const db = getDb();
  const host = new URL(process.env.DATABASE_URL ?? "postgres://unset/").hostname;
  console.log(`${WRITE ? "WRITE" : "dry-run"} against ${host}, event ${SLUG}`);

  const event = await getEventBySlug(SLUG);
  if (!event) throw new Error(`No event row for ${SLUG}`);
  console.log(`Event: ${event.name ?? SLUG} — status "${event.status}"`);

  // ── individual miles: by-heat sheet with team-named banners ────────
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
    if (filled.length === 1 && GROUP_HEATS[filled[0].trim()] !== undefined) {
      relabelled.push([`Heat-${GROUP_HEATS[filled[0].trim()]}`]);
      continue;
    }
    if (filled.length === 1) throw new Error(`Unknown banner "${filled[0]}" on row ${i + 1}`);
    relabelled.push(row);
    // A runner row is followed by its lap row: reading[k] − reading[k−1] must
    // equal the printed lap under reading[k].
    if (row[map.name as number]?.trim()) {
      const laps = byHeat[i + 1] ?? [];
      const readings = splitIdx.map((c) => parseTimeCs(row[c] ?? ""));
      for (let k = 1; k < splitIdx.length; k += 1) {
        const lap = parseTimeCs(laps[splitIdx[k]] ?? "");
        const a = readings[k - 1];
        const b = readings[k];
        if (lap === null || a === null || b === null || b - a !== lap) {
          lapFaults += 1;
          console.log(
            `  LAP MISMATCH ${row[map.name as number]} at ${header[splitIdx[k]]}: ` +
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
  const rankByKey = new Map<string, number>();
  for (const row of ranking.slice(1)) {
    const name = row[rmap.name as number]?.trim();
    const bib = row[rmap.bib as number]?.trim();
    const t = parseTimeCs(row[resultCol] ?? "");
    if (name && bib && t !== null) rankByKey.set(`${bib}:${name}`, t);
  }
  let rankFaults = 0;
  for (const r of parsed.rows) {
    const t = rankByKey.get(`${r.bib}:${r.name}`);
    if (t === undefined || t !== r.timeCs) {
      rankFaults += 1;
      console.log(`  RANKING MISMATCH bib ${r.bib} ${r.name}: by-heat ${r.timeCs}, ranking ${t}`);
    }
  }
  console.log(
    `Ranking sheet: ${rankByKey.size} rows, ${rankFaults === 0 ? "all times agree" : `${rankFaults} disagree`}`,
  );
  if (lapFaults || rankFaults) throw new Error("Sheets disagree — not importing.");

  // ── team run: 3 miles + best 2 pairs out of 4 (01.10 rule) ─────────
  const teamGrid = await xlsxToGrid(readFileSync(teamPath));
  const theader = teamGrid[0];
  const tmap = mapHeaderRow(theader);
  const runnerRows = teamGrid.slice(1).filter((r) => r.filter((c) => c.trim()).length > 1);
  const tparsed = parseTeamGrid(
    [theader, [String(TEAM_HEAT)], ["1", TEAM_NAME, "0.00"], ...runnerRows],
    0,
    tmap,
  );
  for (const e of tparsed.errors) console.log(`  team parser refused row ${e.sourceRow}: ${e.message}`);
  const all = tparsed.teams[0]?.runners ?? [];
  if (all.length === 0) throw new Error("No team runner rows parsed.");
  const MILE_M = 1609;
  for (const r of all) {
    const reachedLine = r.splits?.some((s) => s.m >= MILE_M) ?? true;
    if (r.role !== "ace" && r.status === "finished" && !reachedLine) {
      console.log(`  ${r.name}: last reading ${r.splits?.at(-1)?.m ?? "?"} m — DNF`);
      r.status = "dnf";
      r.timeCs = null;
      r.legTimeCs = null;
    }
  }
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
  const selected: ParsedTeamRunner[] = [
    ...racers,
    ...pairs.flatMap((p, i) => [
      { ...(p.ace as ParsedTeamRunner), pairNo: i + 1 },
      { ...(p.joker as ParsedTeamRunner), pairNo: i + 1 },
    ]),
  ];
  const selectedNames = new Set(selected.map((r) => r.name));
  const teamTimeCs =
    racers.reduce((s, r) => s + (r.timeCs as number), 0) +
    pairs.reduce((s, p) => s + legOf(p.joker), 0);
  const team: ParsedTeam = {
    sourceRow: 0,
    heat: TEAM_HEAT,
    name: TEAM_NAME,
    status: "finished",
    place: 1,
    timeCs: teamTimeCs,
    runners: selected,
  };
  console.log(`\nTeam run: ${all.length} runners on the sheet; not published (outside 3+2):`);
  for (const r of all.filter((r) => !selectedNames.has(r.name))) {
    console.log(`    ${(r.role + (r.pairNo ?? "")).padEnd(7)} ${figure(r).padEnd(14)} ${r.name}`);
  }

  // ── accounts and registrations for everyone who started ───────────
  type Starter = { name: string; dob: string | null };
  const starters = new Map<string, Starter>();
  for (const r of parsed.rows.filter((r) => r.status !== "dns")) starters.set(r.name, r);
  for (const r of all.filter((r) => r.status !== "dns")) {
    // Spelling varies between sheets (PODNEBESNYI / PODENBESNII) — one person.
    const dup = [...starters.values()].find(
      (s) => ALIASES[s.name] && ALIASES[s.name] === ALIASES[r.name],
    );
    if (!dup && !starters.has(r.name)) starters.set(r.name, r);
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
  // Team-sheet spellings resolve to the same account as the by-heat spelling.
  for (const r of all) {
    if (!accountOf.has(r.name)) {
      const a = resolveAccount(r.name, r.dob);
      if (a) accountOf.set(r.name, a);
    }
  }

  const byUser = new Map<string, { names: string[]; a: { user: Account; why: string } }>();
  for (const [name, a] of accountOf) {
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
  const rows = await resolveRegistrations(SLUG, parsed.rows as ParsedResultRow[]);
  const link = (r: { name: string; registrationId: string | null; matchedBy: string | null }) => {
    const a = accountOf.get(r.name);
    const registrationId = a ? regByUser.get(a.user.id) : undefined;
    if (!r.registrationId && registrationId) {
      r.registrationId = registrationId;
      r.matchedBy = "name";
    }
  };
  rows.forEach(link);
  console.log(`\nIndividual miles (${rows.length} rows):`);
  for (const r of rows.slice().sort((a, b) => a.heat - b.heat || (a.place ?? 99) - (b.place ?? 99))) {
    console.log(
      `  heat ${r.heat}  bib ${String(r.bib).padStart(3)}  ` +
        `${r.status === "finished" ? `#${r.place} ${formatTime(r.timeCs as number)}` : r.status.toUpperCase()}  ` +
        `${r.name.padEnd(22)} splits:${r.splits?.length ?? 0}  ` +
        `[${r.matchedBy ?? "UNLINKED"}${r.registrationId || !accountOf.has(r.name) ? "" : " — registration after --write"}]`,
    );
  }
  console.log(`Linked: ${rows.filter((r) => r.registrationId).length}/${rows.length}`);

  const [resolvedTeam] = await resolveTeamResults(SLUG, [team]);
  resolvedTeam.runners.forEach(link);
  console.log(
    `\nHeat ${resolvedTeam.heat}  #${resolvedTeam.place}  ${resolvedTeam.name}  ${formatTime(resolvedTeam.timeCs as number)}  ` +
      `[team ${resolvedTeam.teamId ? `linked ${resolvedTeam.teamId}` : "UNLINKED"}]`,
  );
  for (const r of resolvedTeam.runners) {
    console.log(
      `    ${String(r.bib ?? "—").padStart(3)}  ${(r.role + (r.pairNo ?? "")).padEnd(7)} ${figure(r).padEnd(14)} ` +
        `${r.name.padEnd(22)} splits:${r.splits?.length ?? 0}  [${r.matchedBy ?? "UNLINKED"}]`,
    );
  }
  console.log(
    `Linked runners: ${resolvedTeam.runners.filter((r) => r.registrationId).length}/${resolvedTeam.runners.length}`,
  );

  // ── participation ──────────────────────────────────────────────────
  const grants = [...byUser.values()].map(({ names, a }) => ({
    names,
    user: a.user,
    registrationId: regByUser.get(a.user.id),
  }));
  console.log(`\nParticipation: ${PARTICIPATION_REWARD_ACER} ACER × ${grants.length} starters with an account`);
  for (const g of grants) {
    console.log(
      `  ${g.names[0].padEnd(22)} ${g.user.email}${g.registrationId ? "" : "  (registration after --write)"}`,
    );
  }
  const unpaid = [...starters.values()].filter((s) => !accountOf.has(s.name)).map((s) => s.name);
  console.log(`  not paid (no account): ${unpaid.join(", ") || "—"}`);

  if (!WRITE) {
    console.log("\nDry-run complete — nothing written. Re-run with --write to import.");
    process.exit(0);
  }

  const ind = await replaceHeatResults(SLUG, rows);
  console.log(`\nImported ${ind.rows} individual rows into ${ind.heats} heats.`);
  const tm = await replaceTeamHeatResults(SLUG, [resolvedTeam]);
  console.log(`Imported ${tm.teams} team run, ${tm.rows} runner rows, ${tm.heats} heat.`);

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
