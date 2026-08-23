import ExcelJS from "exceljs";

import type { ResultStatus } from "@/db/schema";

/**
 * Parser for the RaceResult results export (slice: timing integration).
 *
 * The timing operator's export layout is not under our control, so headers are
 * matched case-insensitively against aliases; a round-trip of our own heat
 * export's "Flat" sheet (`Heat | Start | Bib | First name | Surname | Sex | …`
 * plus whatever result columns the operator appends) must parse without edits.
 *
 * Two layouts are read, because the operator exports both:
 *
 * - *flat* — one row per result with a `Heat` column (our own export, and
 *   RaceResult's flat result list);
 * - *by heat* — RaceResult's "Results by Heat" sheet, where the heat arrives as
 *   a `Heat-1` banner row above each group, every athlete row is trailed by a
 *   per-lap split row, and a non-finisher's marker sits in the net-time column
 *   ("DNF") because that sheet has no status column at all.
 *
 * Either way every row must end up carrying a heat: bibs are recycled leases
 * across heats within one event, so `(heat, bib)` — never bib alone —
 * identifies a result (ADR 0003). A file that supplies the heat neither as a
 * column nor as banners is rejected outright.
 */

export type ParsedResultRow = {
  /** 1-based source row number, for error messages and the preview table. */
  sourceRow: number;
  heat: number;
  bib: number;
  status: ResultStatus;
  /** Net time in hundredths of a second; null unless `status` is `finished`. */
  timeCs: number | null;
  /** Finishing place within the heat; null unless `status` is `finished`. */
  place: number | null;
  name: string;
  gender: "M" | "F";
};

export type RowError = {
  /** 1-based source row number; 0 for file-level problems. */
  sourceRow: number;
  message: string;
};

export type ParsedResults = {
  rows: ParsedResultRow[];
  /** Rows (or the file) the parser refused — none of these are imported. */
  errors: RowError[];
};

/** Column roles the parser understands, in the order errors mention them. */
type Field =
  | "heat"
  | "bib"
  | "place"
  | "name"
  | "firstName"
  | "lastName"
  | "gender"
  | "time"
  | "status";

/**
 * Accepted headers per field, lowercased with spaces/dots collapsed. Includes
 * our own Flat-sheet headers and RaceResult's common English labels.
 */
const HEADER_ALIASES: Record<Field, string[]> = {
  heat: ["heat", "contest", "race", "heatnumber", "heatno"],
  bib: ["bib", "bibnumber", "no", "nr", "number", "startnumber", "startno"],
  place: ["place", "rank", "pos", "position"],
  name: ["name", "athlete", "runner"],
  firstName: ["firstname", "givenname"],
  lastName: ["surname", "lastname", "familyname"],
  gender: ["sex", "gender", "mf"],
  time: ["time", "finishtime", "nettime", "netto", "chiptime", "result"],
  status: ["status", "comment", "remark", "remarks"],
};

/** Lowercase and strip everything but letters, so "First name" ≡ "FirstName". */
function normalizeHeader(cell: string): string {
  return cell.toLowerCase().replace(/[^a-z]/g, "");
}

type HeaderMap = Partial<Record<Field, number>>;

/** Match one row of cells against the alias table; undefined where no field fits. */
function mapHeaderRow(cells: string[]): HeaderMap {
  const map: HeaderMap = {};
  cells.forEach((cell, index) => {
    const normalized = normalizeHeader(cell);
    if (!normalized) return;
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [Field, string[]][]) {
      if (map[field] === undefined && aliases.includes(normalized)) {
        map[field] = index;
        return;
      }
    }
  });
  return map;
}

/** Whether a header row locates a name, under either of its two spellings. */
function hasNameColumn(map: HeaderMap): boolean {
  return map.name !== undefined || map.firstName !== undefined || map.lastName !== undefined;
}

/**
 * A header row is one that locates a bib and a name. The heat is deliberately
 * *not* required here — the by-heat layout carries it in banner rows instead —
 * but a file that supplies it neither way still fails, in {@link parseGrid}.
 */
function isHeaderRow(map: HeaderMap): boolean {
  return map.bib !== undefined && hasNameColumn(map);
}

/** `Heat-1`, `Heat 2`, `HEAT 3 final` — the group banner of the by-heat sheet. */
const HEAT_BANNER = /^heat[^0-9]*(\d+)/i;

/**
 * The heat a banner row announces, or null when the row is not a banner. Only a
 * row whose *sole* content is the banner counts: a data row that happens to hold
 * "Heat 3" in some column must never silently re-point the group.
 */
function bannerHeat(cells: string[]): number | null {
  const filled = cells.map((c) => c.trim()).filter(Boolean);
  if (filled.length !== 1) return null;
  const match = HEAT_BANNER.exec(filled[0]);
  return match ? Number.parseInt(match[1], 10) : null;
}

/**
 * A row carrying neither bib nor name — in the by-heat sheet, the per-lap split
 * line written under every athlete. Skipped rather than refused: it continues
 * the row above rather than being a result of its own, and nothing in it could
 * identify a runner anyway.
 */
function isContinuationRow(cells: string[], map: HeaderMap): boolean {
  const filled = (field: Field): boolean => {
    const index = map[field];
    return index !== undefined && (cells[index] ?? "").trim() !== "";
  };
  return !filled("bib") && !filled("name") && !filled("firstName") && !filled("lastName");
}

/** Rows scanned for the header before giving up (banners precede it in our export). */
const HEADER_SCAN_ROWS = 10;

/**
 * Net time → hundredths of a second. Accepts `m:ss`, `m:ss.h`, `m:ss.hh`,
 * `h:mm:ss(.hh)` and bare seconds (`272.15`), with `,` as a decimal comma.
 */
export function parseTimeCs(raw: string): number | null {
  const text = raw.trim().replace(",", ".");
  if (!text) return null;
  const match = /^(?:(\d{1,2}):)?(?:(\d{1,2}):)?(\d{1,4})(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;

  const [, first, second, secondsRaw, fractionRaw] = match;
  const seconds = Number.parseInt(secondsRaw, 10);
  // One decimal digit is tenths; two are hundredths.
  const fraction =
    fractionRaw === undefined
      ? 0
      : Number.parseInt(fractionRaw, 10) * (fractionRaw.length === 1 ? 10 : 1);

  let minutes = 0;
  let hours = 0;
  if (first !== undefined && second !== undefined) {
    hours = Number.parseInt(first, 10);
    minutes = Number.parseInt(second, 10);
  } else if (first !== undefined) {
    minutes = Number.parseInt(first, 10);
  }
  if ((first !== undefined || second !== undefined) && seconds >= 60) return null;
  if (second !== undefined && minutes >= 60) return null;

  return ((hours * 60 + minutes) * 60 + seconds) * 100 + fraction;
}

/** Non-finish markers the timing export may carry in a status/comment column. */
const STATUS_TEXT: Record<string, ResultStatus> = {
  dnf: "dnf",
  dns: "dns",
  dsq: "dsq",
  dq: "dsq",
  disq: "dsq",
  disqualified: "dsq",
  finished: "finished",
  finish: "finished",
  ok: "finished",
};

function parseGender(raw: string): "M" | "F" | null {
  const text = raw.trim().toLowerCase();
  if (["m", "male", "men", "man"].includes(text)) return "M";
  if (["f", "w", "female", "women", "woman"].includes(text)) return "F";
  return null;
}

function parseIntCell(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  return Number.parseInt(text, 10);
}

/**
 * One source row → a parsed row, or the reason it was refused.
 * `bannerHeatNumber` is the heat the most recent banner announced (null before
 * the first one): it supplies the heat for a layout without a heat column, and
 * for a flat file whose heat cell is blank below the first row of a group.
 */
function parseRow(
  cells: string[],
  map: HeaderMap,
  sourceRow: number,
  bannerHeatNumber: number | null,
): ParsedResultRow | RowError {
  const cell = (field: Field): string => {
    const index = map[field];
    return index === undefined ? "" : (cells[index] ?? "").trim();
  };
  const refuse = (message: string): RowError => ({ sourceRow, message });

  // A present-but-unreadable heat cell is a refusal, not a reason to inherit the
  // banner's heat: filing a typo'd row under the previous heat would corrupt the
  // (heat, bib) identity the whole import rests on.
  const heatCell = cell("heat");
  const heat = heatCell ? parseIntCell(heatCell) : bannerHeatNumber;
  if (heat === null || heat < 1) {
    return refuse(
      heatCell
        ? `unreadable heat "${heatCell}"`
        : 'no heat — the row has no heat column and no "Heat-N" banner above it',
    );
  }
  const bib = parseIntCell(cell("bib"));
  if (bib === null || bib < 1) return refuse(`unreadable bib "${cell("bib")}"`);

  const name = cell("name") || [cell("firstName"), cell("lastName")].filter(Boolean).join(" ");
  if (!name) return refuse("no name");

  const gender = parseGender(cell("gender"));
  if (!gender) return refuse(`unreadable sex "${cell("gender")}"`);

  const statusRaw = cell("status").toLowerCase().replace(/[^a-z]/g, "");
  const timeRaw = cell("time");
  // The by-heat sheet has no status column: a non-finisher's marker *is* the net
  // time cell. Letters only, so a real time never reaches the lookup.
  const timeStatusRaw = timeRaw.toLowerCase().replace(/[^a-z]/g, "");
  const status: ResultStatus | undefined =
    STATUS_TEXT[statusRaw] ?? STATUS_TEXT[timeStatusRaw] ?? (timeRaw ? "finished" : undefined);
  if (!status) {
    return refuse(
      statusRaw ? `unknown status "${cell("status")}"` : "no time and no DNF/DNS/DSQ status",
    );
  }

  if (status !== "finished") {
    return { sourceRow, heat, bib, status, timeCs: null, place: null, name, gender };
  }

  const timeCs = parseTimeCs(timeRaw);
  if (timeCs === null) return refuse(`unreadable time "${timeRaw}"`);
  const place = parseIntCell(cell("place"));
  if (place === null || place < 1) return refuse(`unreadable place "${cell("place")}"`);

  return { sourceRow, heat, bib, status, timeCs, place, name, gender };
}

/**
 * Parse a grid of cell texts (however it was read) into result rows. Rows above
 * the header (banners) and fully blank rows are skipped; every other refusal is
 * reported with its source row so the operator can fix the file.
 */
function parseGrid(grid: string[][]): ParsedResults {
  let map: HeaderMap | null = null;
  let headerRow = 0;
  for (let i = 0; i < Math.min(grid.length, HEADER_SCAN_ROWS); i += 1) {
    const candidate = mapHeaderRow(grid[i]);
    if (isHeaderRow(candidate)) {
      map = candidate;
      headerRow = i + 1;
      break;
    }
  }
  if (!map) {
    return {
      rows: [],
      errors: [
        {
          sourceRow: 0,
          message:
            "No header row with both a bib and a name column — the export must also carry the " +
            'heat, either as a "Heat" column or as "Heat-N" banner rows, because a bib alone ' +
            "does not identify a result (bibs are recycled across heats).",
        },
      ],
    };
  }
  if (map.gender === undefined) {
    return { rows: [], errors: [{ sourceRow: 0, message: "No sex column in the header row." }] };
  }

  const rows: ParsedResultRow[] = [];
  const errors: RowError[] = [];
  let bannerHeatNumber: number | null = null;
  for (let i = headerRow; i < grid.length; i += 1) {
    const cells = grid[i];
    if (cells.every((c) => !c.trim())) continue;
    const banner = bannerHeat(cells);
    if (banner !== null) {
      bannerHeatNumber = banner;
      continue;
    }
    if (isContinuationRow(cells, map)) continue;
    const parsed = parseRow(cells, map, i + 1, bannerHeatNumber);
    if ("message" in parsed) errors.push(parsed);
    else rows.push(parsed);
  }

  // Duplicate (heat, bib) is a file-level fault, not a row to silently drop:
  // the second occurrence would replace the first on commit.
  const seen = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.heat}:${row.bib}`;
    const firstRow = seen.get(key);
    if (firstRow !== undefined) {
      errors.push({
        sourceRow: row.sourceRow,
        message: `duplicate heat ${row.heat} / bib ${row.bib} (first seen on row ${firstRow})`,
      });
    } else {
      seen.set(key, row.sourceRow);
    }
  }
  if (errors.some((e) => e.message.startsWith("duplicate heat"))) {
    return { rows: [], errors };
  }

  return { rows, errors };
}

/** Split one CSV line on the delimiter, honouring double-quoted fields. */
function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

/** `,`, `;` (European Excel) or tab — whichever the first non-empty line uses most. */
function detectDelimiter(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const counts: Array<[string, number]> = [",", ";", "\t"].map((d) => [
    d,
    line.split(d).length - 1,
  ]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

function csvToGrid(buffer: Buffer): string[][] {
  // Strip a UTF-8 BOM so the first header cell still matches its alias.
  const text = buffer.toString("utf8").replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => splitCsvLine(line, delimiter));
}

/** An exceljs cell as text — RaceResult exports numbers and rich text alike. */
function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((r) => r.text).join("");
    if ("text" in value) return String(value.text);
    if ("result" in value) return value.result === undefined ? "" : String(value.result);
    if (value instanceof Date) return value.toISOString();
    return "";
  }
  return String(value);
}

async function xlsxToGrid(buffer: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  // Node's Buffer generic and exceljs's bundled Buffer type disagree; same bytes.
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const grid: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cells[colNumber - 1] = cellText(cell);
    });
    grid[rowNumber - 1] = cells.map((c) => c ?? "");
  });
  return grid.map((row) => row ?? []);
}

/**
 * Parse a RaceResult results export by filename extension. The first worksheet
 * of an `.xlsx` is read; anything else is treated as delimiter-detected CSV.
 */
export async function parseResultsFile(filename: string, buffer: Buffer): Promise<ParsedResults> {
  const grid = /\.xlsx$/i.test(filename) ? await xlsxToGrid(buffer) : csvToGrid(buffer);
  return parseGrid(grid);
}
