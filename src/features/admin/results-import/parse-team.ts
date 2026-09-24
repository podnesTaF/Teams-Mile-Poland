import type { ResultSplit, ResultStatus } from "@/db/schema";
import type { RaceRole } from "@/features/teams/rating-rules";

import {
  normalizeHeader,
  parseDob,
  parseGender,
  parseIntCell,
  parseTimeCs,
  readSplits,
  splitColumns,
  type HeaderMap,
  type RowError,
} from "./parse";

/**
 * Parser for the timing operator's **team** export (first seen 22.09.2026,
 * ADR 0014). One sheet, grouped twice:
 *
 * ```
 * Bib | Athlete | Gender | DoB | Joker | Splits | Joker | 9 m … 1609 m | Result
 * 1                                            ← heat banner: a bare number
 * 1 | AB Praga-Poludnie | 21:17.30             ← team: place, name, team time
 * 10 | CELINSKI Robert | M | … |         | 17 |         | … | 5:04.81   ← RACER
 * 7  | SKUP Wojciech   | M | … | Joker-1 | 13 |         | … | 5:28.05   ← JOKER, pair 1
 * 2  | PIDNEBESNYI …   | M | … | Pacer-1 | 4  | 57.41   | … | out       ← ACE, pair 1
 * ```
 *
 * The first `Joker` column is the runner's role (blank = RACER, `Pacer-N` =
 * ACE of pair N, `Joker-N` = JOKER of pair N); the second is the ACE's
 * handover reading. The team row is recognised by its time sitting where a
 * runner's sex would be. Bibs are team seat numbers — two teams in one heat
 * wear the same ones — so a runner is identified within their team, and a
 * blank bib is accepted rather than refused.
 */

export type ParsedTeamRunner = {
  sourceRow: number;
  bib: number | null;
  name: string;
  gender: "M" | "F";
  dob: string | null;
  role: RaceRole;
  /** 1 or 2 for an ACE/JOKER; null for a RACER. */
  pairNo: number | null;
  /** RACERS always `finished` unless the file says DNF/DNS/DSQ. */
  status: ResultStatus;
  /** A RACER's mile; null for ACE/JOKER and for non-finishers. */
  timeCs: number | null;
  /** ACE: handover reading; JOKER: finish (the pair's mile). Null for RACERS. */
  legTimeCs: number | null;
  splits: ResultSplit[] | null;
};

export type ParsedTeam = {
  sourceRow: number;
  heat: number;
  name: string;
  status: ResultStatus;
  /** Place within the heat; null unless `finished`. */
  place: number | null;
  /** Team time as the file scored it; null unless `finished`. */
  timeCs: number | null;
  runners: ParsedTeamRunner[];
};

const ROLE_CELL = /^(pacer|ace|joker)\s*-?\s*(\d)$/i;

const NON_FINISH: Record<string, ResultStatus> = {
  dnf: "dnf",
  dns: "dns",
  dsq: "dsq",
  dq: "dsq",
};

export function parseTeamGrid(
  grid: string[][],
  headerIndex: number,
  map: HeaderMap,
): { teams: ParsedTeam[]; errors: RowError[] } {
  const header = grid[headerIndex];
  const jokerCols = header
    .map((c, i) => (normalizeHeader(c ?? "") === "joker" ? i : -1))
    .filter((i) => i >= 0);
  const roleCol = jokerCols[0];
  const handoverCol = jokerCols[1];
  const splitCols = splitColumns(header);

  const teams: ParsedTeam[] = [];
  const errors: RowError[] = [];
  let heat: number | null = null;
  let team: ParsedTeam | null = null;

  const at = (cells: string[], index: number | undefined): string =>
    index === undefined ? "" : (cells[index] ?? "").trim();

  for (let i = headerIndex + 1; i < grid.length; i += 1) {
    const cells = grid[i] ?? [];
    const sourceRow = i + 1;
    const filled = cells.map((c) => (c ?? "").trim()).filter(Boolean);
    if (filled.length === 0) continue;

    // Heat banner: the row's only content is a number (or "Heat-N").
    if (filled.length === 1) {
      const match = /^(?:heat[^0-9]*)?(\d+)$/i.exec(filled[0]);
      if (match) {
        heat = Number.parseInt(match[1], 10);
        team = null;
        continue;
      }
    }

    const genderCell = at(cells, map.gender);
    const gender = parseGender(genderCell);

    // Team row: place, name, and the team time where a runner's sex would be.
    if (!gender) {
      const place = parseIntCell(at(cells, map.bib));
      const name = at(cells, map.name);
      const timeText = filled.slice(2).find((c) => parseTimeCs(c) !== null) ?? "";
      const timeCs = parseTimeCs(timeText || genderCell);
      if (!name) {
        errors.push({ sourceRow, message: "row is neither a runner nor a team (no name)" });
        continue;
      }
      if (heat === null) {
        errors.push({ sourceRow, message: `team "${name}" appears before any heat banner` });
        continue;
      }
      const finished = timeCs !== null && place !== null;
      team = {
        sourceRow,
        heat,
        name,
        status: finished ? "finished" : "dnf",
        place: finished ? place : null,
        timeCs: finished ? timeCs : null,
        runners: [],
      };
      teams.push(team);
      continue;
    }

    if (!team) {
      errors.push({ sourceRow, message: "runner row before any team row" });
      continue;
    }
    const name = at(cells, map.name);
    if (!name) {
      errors.push({ sourceRow, message: "no name" });
      continue;
    }

    const roleText = at(cells, roleCol);
    let role: RaceRole = "racer";
    let pairNo: number | null = null;
    if (roleText) {
      const match = ROLE_CELL.exec(roleText);
      if (!match) {
        errors.push({ sourceRow, message: `unknown role "${roleText}"` });
        continue;
      }
      role = match[1].toLowerCase() === "joker" ? "joker" : "ace";
      pairNo = Number.parseInt(match[2], 10);
    }

    const resultText = at(cells, map.time);
    const nonFinish = NON_FINISH[resultText.toLowerCase().replace(/[^a-z]/g, "")];
    let status: ResultStatus = nonFinish ?? "finished";
    let timeCs: number | null = null;
    let legTimeCs: number | null = null;
    if (role === "racer") {
      timeCs = nonFinish ? null : parseTimeCs(resultText);
      if (!nonFinish && timeCs === null) status = "dnf";
    } else if (role === "joker") {
      legTimeCs = nonFinish ? null : parseTimeCs(resultText);
      if (!nonFinish && legTimeCs === null) status = "dnf";
    } else {
      // An ACE never finishes: "out" in the result column is the job done.
      legTimeCs = parseTimeCs(at(cells, handoverCol));
      if (legTimeCs === null && !nonFinish) status = "dnf";
    }

    const bibText = at(cells, map.bib);
    team.runners.push({
      sourceRow,
      bib: bibText ? parseIntCell(bibText) : null,
      name,
      gender,
      dob: parseDob(at(cells, map.dob)),
      role,
      pairNo,
      status,
      timeCs,
      legTimeCs,
      splits: readSplits(cells, splitCols),
    });
  }

  // Same (heat, team) twice would replace itself on commit — a file fault.
  const seen = new Set<string>();
  for (const t of teams) {
    const key = `${t.heat}:${t.name.toLowerCase()}`;
    if (seen.has(key)) {
      errors.push({ sourceRow: t.sourceRow, message: `team "${t.name}" twice in heat ${t.heat}` });
      return { teams: [], errors };
    }
    seen.add(key);
  }
  return { teams, errors };
}
