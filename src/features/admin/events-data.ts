import { cache } from "react";
import ExcelJS from "exceljs";
import { and, asc, eq, ilike, isNotNull, isNull, notExists, or, sql } from "drizzle-orm";

import { eventHeats, eventRegistrations, users, type ParticipationStatus } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getBibPool, getEventBySlug } from "@/lib/events/registry";

export type { ParticipationStatus };

export type RosterRow = {
  id: string;
  status: ParticipationStatus;
  bib: number | null;
  /** Set once the bib lease is back in the pool; see {@link holdsBib}. */
  bibReturnedAt: Date | null;
  firstName: string | null;
  lastName: string | null;
  name: string;
  email: string;
  phone: string | null;
  dateOfBirth: Date | null;
  sex: "M" | "F" | null;
  club: string | null;
  /** The heat the runner is seeded into, if any — null is the walk-up case. */
  heatId: string | null;
  heatNumber: number | null;
  heatScheduledAt: Date | null;
  /** Set once their heat has run: they are done, not waiting for a bib. */
  heatFinishedAt: Date | null;
  checkedInAt: Date | null;
  createdAt: Date;
};

const ROSTER_COLUMNS = {
  id: eventRegistrations.id,
  status: eventRegistrations.status,
  bib: eventRegistrations.bib,
  bibReturnedAt: eventRegistrations.bibReturnedAt,
  firstName: users.firstName,
  lastName: users.lastName,
  name: users.name,
  email: users.email,
  phone: users.phone,
  dateOfBirth: users.dateOfBirth,
  sex: users.sex,
  club: users.club,
  heatId: eventRegistrations.heatId,
  heatNumber: eventHeats.number,
  heatScheduledAt: eventHeats.scheduledAt,
  heatFinishedAt: eventHeats.finishedAt,
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
      // The *current* holder only. Bibs are recycled leases (ADR 0003), so a
      // number is worn by several runners across a morning; searching "7" at the
      // desk has to find who is wearing 7 now, not everyone who ever did.
      searchClauses.push(
        and(eq(eventRegistrations.bib, bibNum), isNull(eventRegistrations.bibReturnedAt))!,
      );
    }
    const search = or(...searchClauses);
    if (search) filters.push(search);
  }

  const rows = await db
    .select(ROSTER_COLUMNS)
    .from(eventRegistrations)
    .innerJoin(users, eq(eventRegistrations.userId, users.id))
    // Left, not inner: an unseeded runner is still on the roster.
    .leftJoin(eventHeats, eq(eventRegistrations.heatId, eventHeats.id))
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
    .leftJoin(eventHeats, eq(eventRegistrations.heatId, eventHeats.id))
    .where(and(eq(eventRegistrations.eventSlug, eventSlug), eq(eventRegistrations.id, registrationId)))
    .limit(1);
  return row ? { ...row, status: row.status as ParticipationStatus } : null;
}

/**
 * The event a registration belongs to, or null if there is no such registration.
 *
 * The ticket page's inline admin panel is reached by registration id alone (the
 * QR carries no slug), so the event it acts on is resolved from the row rather
 * than trusted from the form.
 */
export async function getRegistrationEventSlug(registrationId: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ eventSlug: eventRegistrations.eventSlug })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.id, registrationId))
    .limit(1);
  return row?.eventSlug ?? null;
}

/**
 * Count of registrations per status for an event (roster header stats).
 *
 * Request-cached: the event layout's header and the roster page below it both
 * want these counts, and `cache()` keeps that one query per request rather than
 * one per asker.
 */
export const getRosterStats = cache(async (
  eventSlug: string,
): Promise<Record<ParticipationStatus, number>> => {
  const db = getDb();
  const rows = await db
    .select({ status: eventRegistrations.status, count: sql<number>`count(*)::int` })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.eventSlug, eventSlug))
    .groupBy(eventRegistrations.status);

  const out: Record<ParticipationStatus, number> = {
    registered: 0,
    confirmed: 0,
    checked_in: 0,
    no_show: 0,
  };
  // `cancelled` is deprecated and never set; skip any legacy rows defensively.
  for (const r of rows) {
    if (r.status !== "cancelled") out[r.status] = r.count;
  }
  return out;
});

/** Whether a registration currently holds its bib lease (ADR 0003). */
export function holdsBib(row: Pick<RosterRow, "bib" | "bibReturnedAt">): boolean {
  return row.bib !== null && row.bibReturnedAt === null;
}

/** The bibs currently held for an event — the numbers that are out on loan. */
async function heldBibs(eventSlug: string): Promise<Set<number>> {
  const db = getDb();
  const rows = await db
    .select({ bib: eventRegistrations.bib })
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.eventSlug, eventSlug),
        isNotNull(eventRegistrations.bib),
        isNull(eventRegistrations.bibReturnedAt),
      ),
    );
  return new Set(rows.map((r) => r.bib as number));
}

/**
 * The lowest bib in `1..bibPool` nobody is currently holding, or `null` when the
 * pool is exhausted. Bibs are recycled leases (ADR 0003), so a returned number
 * is free again — which is why this cannot be `max(bib) + 1`: that hands out
 * numbers above the pool the venue actually has.
 *
 * Exhaustion is a normal expected state, not an error: callers check a runner in
 * bib-less and tell the desk to free bibs by marking a finished heat complete.
 */
export async function suggestNextBib(eventSlug: string): Promise<number | null> {
  const pool = getBibPool(eventSlug);
  const held = await heldBibs(eventSlug);
  for (let bib = 1; bib <= pool; bib += 1) {
    if (!held.has(bib)) return bib;
  }
  return null;
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

/**
 * Postgres unique-violation SQLSTATE. Drizzle wraps driver errors in a
 * `DrizzleQueryError` that carries no `code` of its own, so the chain has to be
 * walked to reach the `PostgresError` underneath.
 */
export function isUniqueViolation(error: unknown): boolean {
  for (let current = error, depth = 0; current !== null && current !== undefined && depth < 5; depth += 1) {
    if (typeof current !== "object") return false;
    if ((current as { code?: unknown }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Lease a bib and mark checked in. `bibReturnedAt` is cleared because this is a
 * fresh lease — a recycled number must read as held again. Throws a
 * unique-violation error if another runner already holds the bib (partial unique
 * index); callers retry with the next free number.
 */
export async function checkInWithBib(registrationId: string, bib: number) {
  const db = getDb();
  const [row] = await db
    .update(eventRegistrations)
    .set({ bib, bibReturnedAt: null, status: "checked_in", checkedInAt: new Date() })
    .where(eq(eventRegistrations.id, registrationId))
    .returning({ id: eventRegistrations.id, bib: eventRegistrations.bib });
  return row ?? null;
}

/**
 * Lease a bib to a runner who is **already** checked in — the waiting-list case:
 * they were marked present with the pool empty, and a number has since come back
 * from a finished heat.
 *
 * Deliberately touches only the lease, not `status` or `checkedInAt`: they were
 * present before the bib existed, and their arrival time is a fact about the
 * morning, not about inventory.
 *
 * Refused for a runner whose heat has already run: they are `checked_in` with no
 * lease because their bib went back when the heat finished, not because they are
 * waiting for one. Handing them a fresh number would take it straight back out of
 * the pool for somebody who has finished racing.
 *
 * Throws a unique violation if another runner took the number first; callers
 * retry with the next free one.
 */
export async function leaseBibForCheckedIn(
  eventSlug: string,
  registrationId: string,
  bib: number,
): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .update(eventRegistrations)
    .set({ bib, bibReturnedAt: null })
    .where(
      and(
        eq(eventRegistrations.id, registrationId),
        eq(eventRegistrations.eventSlug, eventSlug),
        eq(eventRegistrations.status, "checked_in"),
        notExists(
          db
            .select({ one: sql`1` })
            .from(eventHeats)
            .where(
              and(
                eq(eventHeats.id, eventRegistrations.heatId),
                isNotNull(eventHeats.finishedAt),
              ),
            ),
        ),
      ),
    )
    .returning({ id: eventRegistrations.id });
  return rows.length > 0;
}

/**
 * Mark checked in with no bib — the pool is empty. A runner standing at the desk
 * is never blocked by inventory (ADR 0003); they are present with a bib pending
 * and get one as soon as a finished heat is marked complete. Any previous `bib`
 * value is left alone: it is already returned, so it reads as history, not a
 * lease.
 */
export async function checkInWithoutBib(registrationId: string) {
  const db = getDb();
  await db
    .update(eventRegistrations)
    .set({ status: "checked_in", checkedInAt: new Date() })
    .where(eq(eventRegistrations.id, registrationId));
}

/**
 * Set a registration's status. Leaving `checked_in` releases the bib lease: the
 * number returns to the pool by stamping `bib_returned_at`, while `bib` itself is
 * retained so past results stay accurate (ADR 0003). An earlier return stamp is
 * preserved — the bib went back when its heat finished, not now.
 */
export async function setRegistrationStatus(
  registrationId: string,
  status: Exclude<ParticipationStatus, "checked_in">,
) {
  const db = getDb();
  await db
    .update(eventRegistrations)
    .set({
      status,
      checkedInAt: null,
      bibReturnedAt: sql`case when ${eventRegistrations.bib} is null then null
        else coalesce(${eventRegistrations.bibReturnedAt}, now()) end`,
    })
    .where(eq(eventRegistrations.id, registrationId));
}
