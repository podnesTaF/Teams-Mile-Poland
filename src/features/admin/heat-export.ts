import ExcelJS from "exceljs";
import { asc, eq } from "drizzle-orm";

import { eventHeats, eventRegistrations, users, type ParticipationStatus } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getEventHeats } from "@/features/admin/heats-data";
import { formatHeatTime } from "@/lib/events/heat-time";
import { getEventBySlug } from "@/lib/events/registry";

/**
 * The race-morning heat export — a **new** event-series exporter, distinct from
 * the frozen runners/teams exporter in `export-runners.ts` (legacy team tables
 * are never read or extended). One workbook serves the whole start line:
 *
 * - a **Flat** sheet (every registration, heat + start time + bib) for the
 *   RaceResult timing system — the first sheet, so the workbook opens on it;
 * - one **per-heat** sheet for each heat, so the start-line marshal gets a card
 *   per race;
 * - an **Unassigned** sheet of confirmed (or checked-in) runners in no heat, so
 *   nobody is silently missed.
 *
 * Every sheet is banner-stamped with the generation time so a stale printout is
 * identifiable. The bib column reads from the same lease the desk sees: exported
 * before check-in it is blank (a start list), re-exported mid-morning it carries
 * the leased numbers (ADR 0003 — a bib is a lease, not an identity).
 *
 * The registration query lives here rather than reusing the roster read model:
 * the export is self-contained on the committed schema, so it does not couple to
 * the roster row's evolving shape.
 */

/** One registration as the exporter needs it — DB row, joined to user and heat. */
type ExportRow = {
  status: ParticipationStatus;
  bib: number | null;
  heatId: string | null;
  heatNumber: number | null;
  heatScheduledAt: Date | null;
  firstName: string | null;
  lastName: string | null;
  name: string;
  sex: "M" | "F" | null;
  club: string | null;
  checkedInAt: Date | null;
};

async function getExportRows(eventSlug: string): Promise<ExportRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      status: eventRegistrations.status,
      bib: eventRegistrations.bib,
      heatId: eventRegistrations.heatId,
      heatNumber: eventHeats.number,
      heatScheduledAt: eventHeats.scheduledAt,
      firstName: users.firstName,
      lastName: users.lastName,
      fallbackName: users.name,
      sex: users.sex,
      club: users.club,
      checkedInAt: eventRegistrations.checkedInAt,
    })
    .from(eventRegistrations)
    .innerJoin(users, eq(eventRegistrations.userId, users.id))
    // Left, not inner: an unseeded runner still belongs on the flat sheet.
    .leftJoin(eventHeats, eq(eventRegistrations.heatId, eventHeats.id))
    .where(eq(eventRegistrations.eventSlug, eventSlug))
    .orderBy(asc(users.lastName), asc(users.firstName));

  return rows.map(({ firstName, lastName, fallbackName, ...rest }) => ({
    ...rest,
    // `cancelled` is deprecated and never set — narrow to the live union.
    status: rest.status as ParticipationStatus,
    firstName,
    lastName,
    name: [firstName, lastName].filter(Boolean).join(" ") || fallbackName,
  }));
}

/** A worksheet column: object key for `addRow`, printed header, and width. */
type Col = { key: string; header: string; width: number };

/** Flat sheet — the timing system's view: every registration, one row each. */
const FLAT_COLS: Col[] = [
  { key: "heat", header: "Heat", width: 6 },
  { key: "start", header: "Start", width: 8 },
  { key: "bib", header: "Bib", width: 6 },
  { key: "firstName", header: "First name", width: 18 },
  { key: "lastName", header: "Surname", width: 18 },
  { key: "sex", header: "Sex", width: 5 },
  { key: "club", header: "Club", width: 22 },
  { key: "status", header: "Status", width: 13 },
  { key: "checkedIn", header: "Checked in", width: 20 },
];

/** Per-heat and Unassigned sheets — the start line's view (no heat/start col). */
const CARD_COLS: Col[] = [
  { key: "bib", header: "Bib", width: 6 },
  { key: "firstName", header: "First name", width: 18 },
  { key: "lastName", header: "Surname", width: 18 },
  { key: "sex", header: "Sex", width: 5 },
  { key: "club", header: "Club", width: 22 },
  { key: "status", header: "Status", width: 13 },
];

/** Warsaw-local date + time for the banner stamp and check-in column. */
const DATETIME_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Warsaw",
  dateStyle: "medium",
  timeStyle: "short",
});

function fmtDateTime(date: Date | null): string {
  return date ? DATETIME_FMT.format(date) : "";
}

/** A cell value from a possibly-null number: the number, or blank. */
function num(value: number | null): number | string {
  return value ?? "";
}

/** Human-facing status: `checked_in` → `checked in`. */
function statusText(status: string): string {
  return status.replaceAll("_", " ");
}

/**
 * Flat-sheet order: by heat number, then bib, then surname — the shape the
 * timing operator scans. Unheated and unbibbed runners sort last within their
 * group (a missing number is "not yet", so it belongs at the bottom).
 */
function flatOrder(a: ExportRow, b: ExportRow): number {
  const ah = a.heatNumber ?? Infinity;
  const bh = b.heatNumber ?? Infinity;
  if (ah !== bh) return ah - bh;
  const ab = a.bib ?? Infinity;
  const bb = b.bib ?? Infinity;
  if (ab !== bb) return ab - bb;
  return (a.lastName ?? a.name).localeCompare(b.lastName ?? b.name);
}

/** Start-line order within a heat or the Unassigned list: bib, then surname. */
function cardOrder(a: ExportRow, b: ExportRow): number {
  const ab = a.bib ?? Infinity;
  const bb = b.bib ?? Infinity;
  if (ab !== bb) return ab - bb;
  return (a.lastName ?? a.name).localeCompare(b.lastName ?? b.name);
}

/**
 * Add a worksheet: a spanning italic banner (row 1) so a printout is dated, a
 * bold header (row 2), then one data row per record (row 3+).
 */
function addSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  banner: string,
  cols: Col[],
  records: Record<string, string | number>[],
): void {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = cols.map((c) => ({ key: c.key, width: c.width }));

  sheet.addRow([banner]);
  sheet.mergeCells(1, 1, 1, cols.length);
  sheet.getCell(1, 1).font = { italic: true, size: 10 };

  sheet.addRow(cols.map((c) => c.header));
  sheet.getRow(2).font = { bold: true };

  for (const record of records) sheet.addRow(record);
}

function cardRecord(r: ExportRow): Record<string, string | number> {
  return {
    bib: num(r.bib),
    firstName: r.firstName ?? "",
    lastName: r.lastName ?? "",
    sex: r.sex ?? "",
    club: r.club ?? "",
    status: statusText(r.status),
  };
}

/**
 * Build the heat-export workbook for an event: Flat sheet, one sheet per heat,
 * and an Unassigned sheet.
 */
export async function buildHeatExportWorkbook(eventSlug: string): Promise<Buffer> {
  const [heats, rows] = await Promise.all([getEventHeats(eventSlug), getExportRows(eventSlug)]);
  const event = getEventBySlug(eventSlug);
  const generatedAt = new Date();
  const stamp = `Generated ${fmtDateTime(generatedAt)} Warsaw`;
  const context = event ? `${event.name} · ${stamp}` : stamp;

  const byHeat = new Map<string, ExportRow[]>();
  for (const r of rows) {
    if (!r.heatId) continue;
    const list = byHeat.get(r.heatId);
    if (list) list.push(r);
    else byHeat.set(r.heatId, [r]);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Teams Mile Admin";
  workbook.created = generatedAt;

  // Flat sheet first — the workbook opens on the tab the timing system wants.
  addSheet(
    workbook,
    "Flat",
    context,
    FLAT_COLS,
    [...rows].sort(flatOrder).map((r) => ({
      heat: num(r.heatNumber),
      start: r.heatScheduledAt ? formatHeatTime(r.heatScheduledAt) : "",
      bib: num(r.bib),
      firstName: r.firstName ?? "",
      lastName: r.lastName ?? "",
      sex: r.sex ?? "",
      club: r.club ?? "",
      status: statusText(r.status),
      checkedIn: fmtDateTime(r.checkedInAt),
    })),
  );

  // One sheet per heat, in card order — empty heats still get a (blank) card.
  for (const heat of heats) {
    const members = (byHeat.get(heat.id) ?? []).sort(cardOrder);
    addSheet(
      workbook,
      `Heat ${heat.number}`,
      `Heat ${heat.number} · Start ${formatHeatTime(heat.scheduledAt)} · ${context}`,
      CARD_COLS,
      members.map(cardRecord),
    );
  }

  // Unassigned: confirmed / checked-in runners in no heat, so a walk-up or an
  // unseeded confirmation is never silently absent from the card.
  const unassigned = rows
    .filter((r) => !r.heatId && (r.status === "confirmed" || r.status === "checked_in"))
    .sort(cardOrder);
  addSheet(workbook, "Unassigned", `Unassigned · ${context}`, CARD_COLS, unassigned.map(cardRecord));

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/** Download filename for the heat export, dated so a saved copy is identifiable. */
export function heatExportFilename(eventSlug: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `heats-${eventSlug}-${date}.xlsx`;
}
