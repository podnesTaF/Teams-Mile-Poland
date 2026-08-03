import { and, eq, inArray, notInArray, sql, type SQL } from "drizzle-orm";

import {
  eventRegistrations,
  legacyParticipations,
  users,
  type ParticipationStatus,
} from "@/db/schema";
import { getDb } from "@/lib/db";
import { getIndividualEvents } from "@/lib/events/registry";

import { asMailLocale, type MailLocale } from "./copy";

/**
 * Audience segments for user broadcasts. Fixed identifiers plus parameterized
 * per-event values (`registered:<slug>`, `awaiting_confirmation:<slug>`,
 * `confirmed:<slug>`). Resolved as live queries at send time (never stored
 * lists) over users × legacy participations × registrations, with
 * `marketing_opt_out` exclusion applied centrally in {@link whereForSegment}
 * so no call site can forget it.
 *
 * Per-event confirmation splits matter because Confirmation is per registration
 * (a runner can be confirmed for one mile night and still awaiting for another).
 */
export type UserSegment =
  | "all"
  | "first_event_attended"
  | "first_event_no_show"
  | "registered_any_aug"
  | "not_registered_aug"
  | `registered:${string}`
  | `awaiting_confirmation:${string}`
  | `confirmed:${string}`;

export type UserRecipient = {
  userId: string;
  email: string;
  fullName: string;
  locale: MailLocale;
};

/** The only event with legacy participations today — the completed first event. */
const FIRST_EVENT_SLUG = "warsaw-2026";

const PER_EVENT_PREFIXES = [
  "registered:",
  "awaiting_confirmation:",
  "confirmed:",
] as const;

type PerEventPrefix = (typeof PER_EVENT_PREFIXES)[number];

/** Slugs of every individual mile event — the "Aug events" universe. */
function augEventSlugs(): string[] {
  return getIndividualEvents().map((e) => e.slug);
}

function parsePerEventSegment(
  raw: string,
): { prefix: PerEventPrefix; slug: string } | null {
  for (const prefix of PER_EVENT_PREFIXES) {
    if (raw.startsWith(prefix)) {
      const slug = raw.slice(prefix.length);
      return augEventSlugs().includes(slug) ? { prefix, slug } : null;
    }
  }
  return null;
}

/**
 * Validate a raw form value into a `UserSegment`. A parameterized
 * `<kind>:<slug>` value is accepted only when the slug is a known individual
 * event, so a tampered form can't target an arbitrary string.
 */
export function parseUserSegment(raw: string): UserSegment | null {
  if (
    raw === "all" ||
    raw === "first_event_attended" ||
    raw === "first_event_no_show" ||
    raw === "registered_any_aug" ||
    raw === "not_registered_aug"
  ) {
    return raw;
  }
  const parsed = parsePerEventSegment(raw);
  return parsed ? (raw as UserSegment) : null;
}

/** Consenting users only — opted-out users are never in any segment. */
const notOptedOut = eq(users.marketingOptOut, false);

/** Distinct user ids that hold a legacy participation with the given attendance. */
function firstEventUserIds(attended: boolean) {
  return getDb()
    .select({ id: legacyParticipations.userId })
    .from(legacyParticipations)
    .where(
      and(
        eq(legacyParticipations.eventSlug, FIRST_EVENT_SLUG),
        eq(legacyParticipations.attended, attended),
      ),
    );
}

/**
 * Distinct user ids with a registration for any of `slugs`. When `statuses` is
 * set, only those participation statuses count — used to split awaiting
 * confirmation (`registered`) from confirmed.
 */
function registrationUserIds(slugs: string[], statuses?: ParticipationStatus[]) {
  return getDb()
    .select({ id: eventRegistrations.userId })
    .from(eventRegistrations)
    .where(
      and(
        inArray(eventRegistrations.eventSlug, slugs),
        statuses ? inArray(eventRegistrations.status, statuses) : undefined,
      ),
    );
}

/**
 * The SQL predicate for a segment over `users`, always ANDed with the
 * marketing-opt-out exclusion. This single choke point is why consent can't be
 * forgotten by any resolver or counter.
 */
function whereForSegment(segment: UserSegment): SQL {
  switch (segment) {
    case "all":
      return notOptedOut;
    case "first_event_attended":
      return and(notOptedOut, inArray(users.id, firstEventUserIds(true)))!;
    case "first_event_no_show":
      return and(notOptedOut, inArray(users.id, firstEventUserIds(false)))!;
    case "registered_any_aug":
      return and(notOptedOut, inArray(users.id, registrationUserIds(augEventSlugs())))!;
    case "not_registered_aug":
      return and(notOptedOut, notInArray(users.id, registrationUserIds(augEventSlugs())))!;
    default: {
      const parsed = parsePerEventSegment(segment);
      // parseUserSegment already validated; this is a type narrowing guard.
      if (!parsed) return notOptedOut;
      const { prefix, slug } = parsed;
      if (prefix === "awaiting_confirmation:") {
        return and(
          notOptedOut,
          inArray(users.id, registrationUserIds([slug], ["registered"])),
        )!;
      }
      if (prefix === "confirmed:") {
        return and(
          notOptedOut,
          inArray(users.id, registrationUserIds([slug], ["confirmed"])),
        )!;
      }
      // `registered:<slug>` — any participation status for that event.
      return and(notOptedOut, inArray(users.id, registrationUserIds([slug])))!;
    }
  }
}

function toRecipient(r: {
  id: string;
  email: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  locale: string;
}): UserRecipient {
  return {
    userId: r.id,
    email: r.email,
    fullName:
      [r.firstName, r.lastName].filter(Boolean).join(" ").trim() || r.name || r.email,
    locale: asMailLocale(r.locale),
  };
}

/** Resolve a segment to its (consenting) recipients. */
export async function resolveUserSegment(segment: UserSegment): Promise<UserRecipient[]> {
  const rows = await getDb()
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      firstName: users.firstName,
      lastName: users.lastName,
      locale: users.locale,
    })
    .from(users)
    .where(whereForSegment(segment));
  return rows.map(toRecipient);
}

/** Consenting recipient count for a segment — powers the compose picker labels. */
export async function countUserSegment(segment: UserSegment): Promise<number> {
  const [row] = await getDb()
    .select({ value: sql<number>`count(*)::int` })
    .from(users)
    .where(whereForSegment(segment));
  return row?.value ?? 0;
}

export type SegmentOption = { value: UserSegment; label: string; count: number };

/**
 * Every offered segment with its live recipient count, in picker order. Each
 * individual event is listed three ways — all registrations, awaiting
 * confirmation, and confirmed — so campaigns (especially confirmation nudges)
 * stay scoped to one mile night and one participation status.
 */
export async function describeUserSegments(): Promise<SegmentOption[]> {
  const base: { value: UserSegment; label: string }[] = [
    { value: "all", label: "All users" },
    { value: "first_event_attended", label: "First event · attended" },
    { value: "first_event_no_show", label: "First event · no-show" },
    { value: "registered_any_aug", label: "Registered for any Aug event" },
    { value: "not_registered_aug", label: "Not registered for any Aug event" },
    ...getIndividualEvents().flatMap((e) => [
      {
        value: `registered:${e.slug}` as UserSegment,
        label: `${e.shortDate} · all registrations`,
      },
      {
        value: `awaiting_confirmation:${e.slug}` as UserSegment,
        label: `${e.shortDate} · awaiting confirmation`,
      },
      {
        value: `confirmed:${e.slug}` as UserSegment,
        label: `${e.shortDate} · confirmed`,
      },
    ]),
  ];
  return Promise.all(
    base.map(async (o) => ({ ...o, count: await countUserSegment(o.value) })),
  );
}
