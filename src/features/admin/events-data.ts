import { cache } from "react";
import ExcelJS from "exceljs";
import { and, eq, ilike, isNotNull, isNull, ne, notExists, or, sql, type SQL } from "drizzle-orm";

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

/** Which roster column the table is ordered by. */
export type RosterSortKey = "bib" | "name" | "status" | "registered-at";

export type RosterSort = { key: RosterSortKey; dir: "asc" | "desc" };

/**
 * Bibs first and ascending, then alphabetically — the order the roster has
 * always had, and the one a check-in desk reads down.
 */
export const DEFAULT_ROSTER_SORT: RosterSort = { key: "bib", dir: "asc" };

/** What a runner sorts and is searched under: surname, or the single-field name. */
const SORT_NAME = sql`coalesce(${users.lastName}, ${users.name})`;

/** How the roster is filtered — shared by the page read and its count. */
export type RosterFilter = {
  status?: ParticipationStatus;
  q?: string;
  /**
   * Widen the free-text search to the runner's club. Off by default because the
   * other caller is the check-in desk, whose search box promises "name, email or
   * bib" in three places — a club typed there would return every one of its
   * members as a card with live check-in buttons.
   */
  searchClub?: boolean;
};

/** Which slice of the filtered roster to return; omit for all of it. */
export type RosterWindow = { sort?: RosterSort; limit?: number; offset?: number };

function rosterFilters(eventSlug: string, opts: RosterFilter): SQL[] {
  const filters = [
    eq(eventRegistrations.eventSlug, eventSlug),
    // `cancelled` is deprecated and never written, but the physical enum value
    // still exists (dropping it is not an additive migration). Excluding it here
    // rather than only in the mappers is what lets the roster's row read, its
    // count and `getRosterStats` — which also skips it — agree on one number;
    // `overview-data` and `users-data` already exclude it the same way.
    ne(eventRegistrations.status, "cancelled"),
  ];

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
    if (opts.searchClub) searchClauses.push(ilike(users.club, like));
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

  return filters;
}

/**
 * The `ORDER BY` for a sort choice, always ending in a total order.
 *
 * Two deliberate details. Rows missing the sorted value go to the bottom in
 * *both* directions — a roster ordered by bib is asking about the runners who
 * have a number, and flipping to descending should not answer with the ones who
 * never had one. (It sorts on `bib` itself, not on the lease: a returned number
 * is history the roster still shows, which is why the *search* — where the
 * question is "who is wearing 7 right now" — is the one that checks
 * `bibReturnedAt`.) And the id tiebreaker is what makes pagination trustworthy: without
 * a total order Postgres may place two runners who tie on the sort key
 * differently between the query for page 1 and the query for page 2, so one is
 * shown twice and the other never.
 */
function rosterOrder(sort: RosterSort): SQL[] {
  const dir = sort.dir === "desc" ? sql`desc` : sql`asc`;
  const primary: Record<RosterSortKey, SQL> = {
    bib: sql`${eventRegistrations.bib} ${dir} nulls last`,
    name: sql`${SORT_NAME} ${dir} nulls last`,
    // Enum columns order by declaration, which here is the participation
    // lifecycle itself: registered → confirmed → checked_in → no_show.
    status: sql`${eventRegistrations.status} ${dir}`,
    "registered-at": sql`${eventRegistrations.createdAt} ${dir}`,
  };
  const secondary = sort.key === "name" ? sql`${users.firstName} asc` : sql`${SORT_NAME} asc`;
  return [primary[sort.key], secondary, sql`${eventRegistrations.id} asc`];
}

/**
 * Roster for an event (registrations ⋈ users), optionally filtered by status and
 * a free-text query over name / email / club / bib, ordered by any of the four
 * sortable columns, and optionally windowed to one page.
 *
 * Filtering, sorting and paging all happen in the database: the admin table is
 * URL state over this read, not a client-side table library.
 */
export async function getEventRoster(
  eventSlug: string,
  opts: RosterFilter & RosterWindow = {},
): Promise<RosterRow[]> {
  const db = getDb();

  const query = db
    .select(ROSTER_COLUMNS)
    .from(eventRegistrations)
    .innerJoin(users, eq(eventRegistrations.userId, users.id))
    // Left, not inner: an unseeded runner is still on the roster.
    .leftJoin(eventHeats, eq(eventRegistrations.heatId, eventHeats.id))
    .where(and(...rosterFilters(eventSlug, opts)))
    .orderBy(...rosterOrder(opts.sort ?? DEFAULT_ROSTER_SORT));

  const rows =
    opts.limit === undefined ? await query : await query.limit(opts.limit).offset(opts.offset ?? 0);
  // `cancelled` is deprecated and never set — narrow to the live union.
  return rows.map((r) => ({ ...r, status: r.status as ParticipationStatus }));
}

/**
 * How many rows {@link getEventRoster} would return for the same filter, ignoring
 * any window — i.e. how many pages the roster table has.
 *
 * Separate from the read rather than a window function on it so the read keeps
 * returning plain `RosterRow[]`, and so an empty page costs one cheap count
 * instead of dragging every matching row back to decide there are none.
 */
export async function countEventRoster(
  eventSlug: string,
  opts: RosterFilter = {},
): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eventRegistrations)
    // Inner join, as in the read: the free-text filter is over user columns.
    .innerJoin(users, eq(eventRegistrations.userId, users.id))
    .where(and(...rosterFilters(eventSlug, opts)));
  return row?.count ?? 0;
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
 * Lease a bib ahead of check-in — the heat builder's manual pre-assignment. The
 * number is held from this moment (same partial unique index as every lease,
 * ADR 0003), so the desk's suggestions skip it and the results import can
 * resolve the (heat, bib) identity even for a runner nobody pressed Check in
 * for. Status is deliberately untouched: holding a number is not being present.
 *
 * Refused when the runner's heat has already run — its bibs went back to the
 * pool when it finished, and a fresh lease would take one out again for
 * somebody who is done racing. Throws a unique violation when another runner
 * holds the number; callers surface it rather than retrying, because the admin
 * chose this bib on purpose.
 */
export async function preassignBib(
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
 * Take back a pre-assigned bib that has not been worn: the lease is cleared
 * outright (`bib = null`) rather than stamped returned — before the race the
 * number has no history to retain, and a retained value would hand the results
 * import a stale (heat, bib) identity to trip over.
 *
 * Refused for checked-in runners: the desk owns live-morning leases, and
 * reverting or no-showing a runner is the way theirs comes back.
 */
export async function clearPreassignedBib(
  eventSlug: string,
  registrationId: string,
): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .update(eventRegistrations)
    .set({ bib: null })
    .where(
      and(
        eq(eventRegistrations.id, registrationId),
        eq(eventRegistrations.eventSlug, eventSlug),
        isNotNull(eventRegistrations.bib),
        isNull(eventRegistrations.bibReturnedAt),
        ne(eventRegistrations.status, "checked_in"),
      ),
    )
    .returning({ id: eventRegistrations.id });
  return rows.length > 0;
}

/** The bib a registration is currently holding, or null when it has no lease. */
export async function getHeldBib(registrationId: string): Promise<number | null> {
  const db = getDb();
  const [row] = await db
    .select({ bib: eventRegistrations.bib })
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.id, registrationId),
        isNotNull(eventRegistrations.bib),
        isNull(eventRegistrations.bibReturnedAt),
      ),
    )
    .limit(1);
  return row?.bib ?? null;
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
