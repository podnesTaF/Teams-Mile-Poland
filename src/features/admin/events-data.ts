import ExcelJS from "exceljs";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";

import { eventRegistrations, users, type ParticipationStatus } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getEventBySlug } from "@/lib/events/registry";

export type { ParticipationStatus };

export type RosterRow = {
  id: string;
  status: ParticipationStatus;
  bib: number | null;
  firstName: string | null;
  lastName: string | null;
  name: string;
  email: string;
  phone: string | null;
  dateOfBirth: Date | null;
  sex: "M" | "F" | null;
  club: string | null;
  checkedInAt: Date | null;
  createdAt: Date;
};

const ROSTER_COLUMNS = {
  id: eventRegistrations.id,
  status: eventRegistrations.status,
  bib: eventRegistrations.bib,
  firstName: users.firstName,
  lastName: users.lastName,
  name: users.name,
  email: users.email,
  phone: users.phone,
  dateOfBirth: users.dateOfBirth,
  sex: users.sex,
  club: users.club,
  checkedInAt: eventRegistrations.checkedInAt,
  createdAt: eventRegistrations.createdAt,
};

/**
 * Roster for an event (registrations ⋈ users), optionally filtered by status
 * and a free-text query over name / email / bib. Ordered by bib then name so
 * checked-in runners with bibs sort first.
 */
export async function getEventRoster(
  eventSlug: string,
  opts: { status?: ParticipationStatus; q?: string } = {},
): Promise<RosterRow[]> {
  const db = getDb();
  const filters = [eq(eventRegistrations.eventSlug, eventSlug)];

  if (opts.status) {
    filters.push(eq(eventRegistrations.status, opts.status));
  }

  const q = opts.q?.trim();
  if (q) {
    const like = `%${q}%`;
    const searchClauses = [
      ilike(users.firstName, like),
      ilike(users.lastName, like),
      ilike(users.name, like),
      ilike(users.email, like),
    ];
    const bibNum = Number.parseInt(q, 10);
    if (Number.isInteger(bibNum)) {
      searchClauses.push(eq(eventRegistrations.bib, bibNum));
    }
    const search = or(...searchClauses);
    if (search) filters.push(search);
  }

  const rows = await db
    .select(ROSTER_COLUMNS)
    .from(eventRegistrations)
    .innerJoin(users, eq(eventRegistrations.userId, users.id))
    .where(and(...filters))
    .orderBy(asc(eventRegistrations.bib), asc(users.lastName));
  // `cancelled` is deprecated and never set — narrow to the live union.
  return rows.map((r) => ({ ...r, status: r.status as ParticipationStatus }));
}

/** A single roster row by registration id (scoped to the event), or null. */
export async function getRosterRowById(
  eventSlug: string,
  registrationId: string,
): Promise<RosterRow | null> {
  const db = getDb();
  const [row] = await db
    .select(ROSTER_COLUMNS)
    .from(eventRegistrations)
    .innerJoin(users, eq(eventRegistrations.userId, users.id))
    .where(and(eq(eventRegistrations.eventSlug, eventSlug), eq(eventRegistrations.id, registrationId)))
    .limit(1);
  return row ? { ...row, status: row.status as ParticipationStatus } : null;
}

/** Count of registrations per status for an event (roster header stats). */
export async function getRosterStats(eventSlug: string): Promise<Record<ParticipationStatus, number>> {
  const db = getDb();
  const rows = await db
    .select({ status: eventRegistrations.status, count: sql<number>`count(*)::int` })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.eventSlug, eventSlug))
    .groupBy(eventRegistrations.status);

  const out: Record<ParticipationStatus, number> = {
    registered: 0,
    checked_in: 0,
    no_show: 0,
  };
  // `cancelled` is deprecated and never set; skip any legacy rows defensively.
  for (const r of rows) {
    if (r.status !== "cancelled") out[r.status] = r.count;
  }
  return out;
}

/** The next free bib for an event: max(assigned bib) + 1 (or 1). */
export async function suggestNextBib(eventSlug: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ max: sql<number | null>`max(${eventRegistrations.bib})` })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.eventSlug, eventSlug));
  return (row?.max ?? 0) + 1;
}

/**
 * Athletics age category from date of birth, using the event year. Youth bands
 * follow birth-year convention; seniors/masters/veterans by age. Mirrors the
 * `AGE_CATEGORIES` config; for admin reference (not official seeding).
 */
export function ageCategoryForDob(dob: Date | null, eventDate: Date): string {
  if (!dob) return "";
  const a = eventDate.getFullYear() - dob.getFullYear();
  if (a <= 12) return "U12";
  if (a <= 14) return "U14";
  if (a <= 16) return "U16";
  if (a <= 18) return "U18";
  if (a <= 20) return "U20";
  if (a <= 23) return "U23";
  if (a <= 39) return "SEN";
  if (a <= 54) return "M40";
  return "V55";
}

function fmtDate(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function fmtDob(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

/** Build a single-sheet XLSX roster for an event, with computed age category. */
export async function buildEventRosterWorkbook(eventSlug: string): Promise<Buffer> {
  const rows = await getEventRoster(eventSlug);
  const event = getEventBySlug(eventSlug);
  const eventDate = event ? new Date(event.date) : new Date();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Teams Mile Admin";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Roster");
  sheet.columns = [
    { header: "Bib", key: "bib", width: 8 },
    { header: "First name", key: "firstName", width: 20 },
    { header: "Surname", key: "lastName", width: 20 },
    { header: "Sex", key: "sex", width: 6 },
    { header: "Date of birth", key: "dob", width: 14 },
    { header: "Age cat.", key: "ageCat", width: 10 },
    { header: "Club", key: "club", width: 24 },
    { header: "Email", key: "email", width: 30 },
    { header: "Phone", key: "phone", width: 18 },
    { header: "Status", key: "status", width: 14 },
    { header: "Checked in", key: "checkedInAt", width: 20 },
    { header: "Registered", key: "createdAt", width: 20 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const r of rows) {
    sheet.addRow({
      bib: r.bib ?? "",
      firstName: r.firstName ?? "",
      lastName: r.lastName ?? "",
      sex: r.sex ?? "",
      dob: fmtDob(r.dateOfBirth),
      ageCat: ageCategoryForDob(r.dateOfBirth, eventDate),
      club: r.club ?? "",
      email: r.email,
      phone: r.phone ?? "",
      status: r.status.replaceAll("_", " "),
      checkedInAt: fmtDate(r.checkedInAt),
      createdAt: fmtDate(r.createdAt),
    });
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export function rosterExportFilename(eventSlug: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `roster-${eventSlug}-${date}.xlsx`;
}

/* ── check-in mutations ─────────────────────────────────────────────── */

/** Postgres unique-violation SQLSTATE. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

/**
 * Assign a bib and mark checked in. Throws a unique-violation error if the bib
 * is already taken for this event (partial unique index) — callers retry or
 * surface "bib taken".
 */
export async function checkInWithBib(registrationId: string, bib: number) {
  const db = getDb();
  const [row] = await db
    .update(eventRegistrations)
    .set({ bib, status: "checked_in", checkedInAt: new Date() })
    .where(eq(eventRegistrations.id, registrationId))
    .returning({ id: eventRegistrations.id, bib: eventRegistrations.bib });
  return row ?? null;
}

/** Set a registration's status; clears bib/check-in time for non-checked states. */
export async function setRegistrationStatus(
  registrationId: string,
  status: Exclude<ParticipationStatus, "checked_in">,
) {
  const db = getDb();
  await db
    .update(eventRegistrations)
    .set({ status, checkedInAt: null })
    .where(eq(eventRegistrations.id, registrationId));
}
