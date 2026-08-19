import { and, eq, exists, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { nameKey } from "@/lib/events/name-key";
import { racesRunPerUser } from "@/lib/events/participation";

/**
 * The admin duplicates report: which accounts probably belong to the same
 * person (task 09).
 *
 * Nothing here merges anything. Two accounts for one runner are a data fact the
 * desk has to see before it can act, and the acting is manual — delete the
 * account nobody used, or re-register the person on the one they keep, both from
 * the existing user detail page. This module only *finds* the pairs.
 *
 * ## The three signals
 * - **phone** — equal `users.phone_e164`, the canonical dedup key derived by
 *   `toE164()` (task 08). The strongest signal we have: it is only set when
 *   libphonenumber confirmed the number, and the column is deliberately not
 *   unique so duplicates stay representable.
 * - **name + date of birth** — equal `nameKey(name)` *and* equal
 *   `date_of_birth`. Name alone is not a signal at all (Poland has plenty of
 *   real Kowalskis), so a name match without a birth date on both sides is
 *   never reported.
 * - **email** — equal `lower(email)`. A diagnostic: once migration 0019's
 *   `users_email_lower_uq` is applied this can no longer happen, and a non-empty
 *   result means the index is missing. Kept for exactly that reason.
 *
 * `nameKey()` is applied in TypeScript, not translated into SQL: it is the same
 * function the results↔profile matcher uses, and a SQL twin of it would be a
 * second definition of "the same name" free to drift from the first. The
 * database narrows to accounts that *share a birth date* — one indexable
 * predicate — and the name comparison then runs over that handful of rows.
 *
 * ## Groups, not pairs
 * A duplicate pair usually trips several signals at once (same person, same
 * phone, same name and birth date), and three independent group queries would
 * list it three times. Candidate groups that share any member are merged into
 * one cluster carrying every signal that matched it, so the report has one card
 * per *person* and states all the evidence for that card.
 *
 * ## Cost
 * {@link countDuplicateGroups} runs on every users-list load, so the candidate
 * queries return ids only — the per-member detail and the races-run aggregates
 * are a second query that {@link listDuplicateGroups} alone pays for. The phone
 * and email lookups ride their indexes (`users_phone_e164_idx`,
 * `users_email_lower_uq`); the birth-date one is a scan of `users`, the same
 * order of cost as the `getUserStats` totals rendered beside it.
 */

type Db = ReturnType<typeof getDb>;

/** Why a group is a group. */
export type DuplicateSignal = "phone" | "name_dob" | "email";

/** One matched signal, with the value the accounts agreed on. */
export type DuplicateMatch = { signal: DuplicateSignal; value: string };

/** One account inside a duplicate group. */
export type DuplicateMember = {
  id: string;
  /** Profile name (first + last) when filled in, else the account name. */
  name: string;
  email: string;
  emailVerified: boolean;
  /** Display phone as typed; `phoneE164` is the key it was matched on. */
  phone: string | null;
  phoneE164: string | null;
  /** `YYYY-MM-DD`, read as text so no timezone can shift the calendar day. */
  dateOfBirth: string | null;
  createdAt: Date;
  /** Races run, per the canonical definition (`src/lib/events/participation.ts`). */
  raceCount: number;
};

export type DuplicateGroup = {
  /** Stable identity for the card: its member ids, sorted. */
  id: string;
  /** Every signal that pulled this group together, strongest first. */
  matches: DuplicateMatch[];
  /** At least two accounts, oldest first — the one to keep is usually the oldest. */
  members: DuplicateMember[];
};

/** `date_of_birth` as a calendar string, for both the match key and the column. */
const DOB_TEXT = sql<string>`to_char(${users.dateOfBirth}, 'YYYY-MM-DD')`;

/** Phone first: it is the signal least likely to be a coincidence. */
const SIGNAL_ORDER: DuplicateSignal[] = ["phone", "name_dob", "email"];

/**
 * What the report calls a person: the profile name when the two fields are
 * filled in, the Better Auth account name otherwise — the same fallback the
 * users table renders, so a row here and a row there read the same.
 */
function personName(u: { name: string; firstName: string | null; lastName: string | null }): string {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.name;
}

/** One account's candidacy for one signal: what it grouped on, and how to say so. */
type CandidateRow = { id: string; key: string; value: string };

/** A set of accounts that share one signal's value. */
type Candidate = { signal: DuplicateSignal; value: string; ids: string[] };

/**
 * Group candidate rows by their key, keeping only the keys more than one account
 * holds. The `> 1` filter is redundant for the signals the database already
 * narrowed with an `exists` and load-bearing for the ones grouped here.
 */
function groupCandidates(rows: CandidateRow[], signal: DuplicateSignal): Candidate[] {
  const byKey = new Map<string, { value: string; ids: string[] }>();
  for (const row of rows) {
    if (!row.key) continue;
    const group = byKey.get(row.key);
    if (group) group.ids.push(row.id);
    else byKey.set(row.key, { value: row.value, ids: [row.id] });
  }
  return [...byKey.values()]
    .filter((group) => group.ids.length > 1)
    .map((group) => ({ signal, value: group.value, ids: group.ids }));
}

/** Accounts whose `phone_e164` another account also has. */
async function phoneCandidates(db: Db): Promise<Candidate[]> {
  const peer = alias(users, "phone_peer");
  const rows = await db
    .select({ id: users.id, key: users.phoneE164 })
    .from(users)
    .where(
      and(
        isNotNull(users.phoneE164),
        exists(
          db
            .select({ one: sql`1` })
            .from(peer)
            .where(and(eq(peer.phoneE164, users.phoneE164), ne(peer.id, users.id))),
        ),
      ),
    );
  return groupCandidates(
    rows.map((r) => ({ id: r.id, key: r.key ?? "", value: r.key ?? "" })),
    "phone",
  );
}

/**
 * Accounts that share a birth date *and*, once `nameKey` has had its say, a
 * name. The database returns everyone whose birth date is not unique; most of
 * those are strangers born on the same day and are dropped here.
 */
async function nameDobCandidates(db: Db): Promise<Candidate[]> {
  const peer = alias(users, "dob_peer");
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      firstName: users.firstName,
      lastName: users.lastName,
      dateOfBirth: DOB_TEXT,
    })
    .from(users)
    .where(
      and(
        isNotNull(users.dateOfBirth),
        exists(
          db
            .select({ one: sql`1` })
            .from(peer)
            .where(and(eq(peer.dateOfBirth, users.dateOfBirth), ne(peer.id, users.id))),
        ),
      ),
    );

  return groupCandidates(
    rows.map((row) => {
      const display = personName(row);
      // An empty key means a name with no letters in it at all; those must not
      // all collide on their birth date alone.
      const key = nameKey(display);
      return {
        id: row.id,
        key: key ? `${key}|${row.dateOfBirth}` : "",
        value: `${display} · ${row.dateOfBirth}`,
      };
    }),
    "name_dob",
  );
}

/**
 * Accounts sharing a case-insensitive email. Impossible once migration 0019's
 * unique index on `lower(email)` is in place — a hit here is a missing index.
 */
async function emailCandidates(db: Db): Promise<Candidate[]> {
  const peer = alias(users, "email_peer");
  const emailKey = sql<string>`lower(${users.email})`;
  const rows = await db
    .select({ id: users.id, key: emailKey })
    .from(users)
    .where(
      exists(
        db
          .select({ one: sql`1` })
          .from(peer)
          .where(and(eq(sql`lower(${peer.email})`, emailKey), ne(peer.id, users.id))),
      ),
    );
  return groupCandidates(
    rows.map((r) => ({ id: r.id, key: r.key, value: r.key })),
    "email",
  );
}

/** A merged group of accounts: their ids, plus every signal that matched them. */
type Cluster = { ids: Set<string>; matches: DuplicateMatch[] };

/**
 * Merge candidate groups that share an account into one cluster each, so a pair
 * caught by phone *and* by name+DOB is one card stating both — not two cards
 * about the same two people.
 *
 * A plain union by shared member: each candidate joins the cluster of any
 * account it already knows, absorbing the other clusters it bridges.
 */
function mergeClusters(candidates: Candidate[]): Cluster[] {
  const clusters = new Set<Cluster>();
  const clusterOf = new Map<string, Cluster>();

  for (const candidate of candidates) {
    const touched = [
      ...new Set(candidate.ids.map((id) => clusterOf.get(id)).filter((c): c is Cluster => !!c)),
    ];
    const target = touched[0] ?? { ids: new Set<string>(), matches: [] };
    if (!touched.length) clusters.add(target);

    for (const other of touched.slice(1)) {
      for (const id of other.ids) {
        target.ids.add(id);
        clusterOf.set(id, target);
      }
      target.matches.push(...other.matches);
      clusters.delete(other);
    }

    for (const id of candidate.ids) {
      target.ids.add(id);
      clusterOf.set(id, target);
    }
    target.matches.push({ signal: candidate.signal, value: candidate.value });
  }

  return [...clusters];
}

/**
 * Every duplicate cluster, as ids and signals only — the cheap half of the
 * report, and all {@link countDuplicateGroups} needs.
 */
async function duplicateClusters(db: Db): Promise<Cluster[]> {
  const [phone, nameDob, email] = await Promise.all([
    phoneCandidates(db),
    nameDobCandidates(db),
    emailCandidates(db),
  ]);
  return mergeClusters([...phone, ...nameDob, ...email]);
}

/** The per-member detail the report renders, keyed by user id. */
async function loadMembers(db: Db, ids: string[]): Promise<Map<string, DuplicateMember>> {
  const { seriesAgg, legacyAgg, racesRun } = racesRunPerUser(db);
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      emailVerified: users.emailVerified,
      phone: users.phone,
      phoneE164: users.phoneE164,
      dateOfBirth: DOB_TEXT,
      createdAt: users.createdAt,
      raceCount: racesRun,
    })
    .from(users)
    .leftJoin(seriesAgg, eq(seriesAgg.userId, users.id))
    .leftJoin(legacyAgg, eq(legacyAgg.userId, users.id))
    .where(inArray(users.id, ids));

  return new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        name: personName(row),
        email: row.email,
        emailVerified: row.emailVerified,
        phone: row.phone,
        phoneE164: row.phoneE164,
        dateOfBirth: row.dateOfBirth,
        createdAt: row.createdAt,
        raceCount: row.raceCount,
      },
    ]),
  );
}

/**
 * The whole report: one group per person who appears to hold several accounts,
 * biggest groups first and, within a size, the most recently created group
 * first — a duplicate made this morning is the one still worth a message.
 *
 * Throws if the store cannot answer (notably before migration 0019 has added
 * `phone_e164`). That is deliberate: this page's only job is these queries, and
 * an empty report would be indistinguishable from "no duplicates". The users
 * list's header count degrades quietly instead — see
 * {@link countDuplicateGroups}.
 */
export async function listDuplicateGroups(): Promise<DuplicateGroup[]> {
  const db = getDb();
  const clusters = await duplicateClusters(db);
  if (clusters.length === 0) return [];

  const members = await loadMembers(
    db,
    clusters.flatMap((cluster) => [...cluster.ids]),
  );

  return clusters
    .map((cluster) => {
      const ids = [...cluster.ids].sort();
      return {
        id: ids.join(":"),
        matches: [...cluster.matches].sort(
          (a, b) => SIGNAL_ORDER.indexOf(a.signal) - SIGNAL_ORDER.indexOf(b.signal),
        ),
        members: ids
          .map((id) => members.get(id))
          .filter((m): m is DuplicateMember => !!m)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
      };
    })
    // A cluster whose members all vanished between the two queries (a delete
    // landing mid-read) would render as an empty card.
    .filter((group) => group.members.length > 1)
    .sort(
      (a, b) =>
        b.members.length - a.members.length ||
        newest(b.members) - newest(a.members) ||
        a.id.localeCompare(b.id),
    );
}

/** When the newest account in a group was created — the group's own recency. */
function newest(members: DuplicateMember[]): number {
  return Math.max(...members.map((m) => m.createdAt.getTime()));
}

/**
 * How many duplicate groups the report would show, for the users list's
 * "Possible duplicates: N" link.
 *
 * Returns `null` — not `0` — when the number cannot be established: no database
 * configured, or a query the store cannot answer. `phone_e164` arrives with
 * migration 0019, so on a store that has not been migrated yet this read fails,
 * and the users list must keep working: the caller hides the link on `null`
 * rather than claiming there are no duplicates. The report page itself still
 * fails loudly, which is where the missing migration should be noticed.
 */
export async function countDuplicateGroups(): Promise<number | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    return (await duplicateClusters(getDb())).length;
  } catch (error) {
    console.warn("[duplicates] group count unavailable:", error);
    return null;
  }
}
