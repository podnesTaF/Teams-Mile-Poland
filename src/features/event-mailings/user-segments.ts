import { and, eq, inArray, notInArray, sql, type SQL } from "drizzle-orm";

import { eventRegistrations, legacyParticipations, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getIndividualEvents } from "@/lib/events/registry";

import { asMailLocale, type MailLocale } from "./copy";

/**
 * Audience segments for user broadcasts. Fixed identifiers plus the
 * parameterized `registered:<event-slug>`. Resolved as live queries at send
 * time (never stored lists) over users × legacy participations × registrations,
 * with `marketing_opt_out` exclusion applied centrally in {@link whereForSegment}
 * so no call site can forget it.
 */
export type UserSegment =
  | "all"
  | "first_event_attended"
  | "first_event_no_show"
  | "registered_any_aug"
  | "not_registered_aug"
  | `registered:${string}`;

export type UserRecipient = {
  userId: string;
  email: string;
  fullName: string;
  locale: MailLocale;
};

/** The only event with legacy participations today — the completed first event. */
const FIRST_EVENT_SLUG = "warsaw-2026";

/** Slugs of every individual mile event — the "Aug events" universe. */
function augEventSlugs(): string[] {
  return getIndividualEvents().map((e) => e.slug);
}

/**
 * Validate a raw form value into a `UserSegment`. A `registered:<slug>` value is
 * accepted only when the slug is a known individual event, so a tampered form
 * can't target an arbitrary string.
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
  if (raw.startsWith("registered:")) {
    const slug = raw.slice("registered:".length);
    return augEventSlugs().includes(slug) ? (raw as UserSegment) : null;
  }
  return null;
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

/** Distinct user ids registered for any event in `slugs`. */
function registeredUserIds(slugs: string[]) {
  return getDb()
    .select({ id: eventRegistrations.userId })
    .from(eventRegistrations)
    .where(inArray(eventRegistrations.eventSlug, slugs));
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
      return and(notOptedOut, inArray(users.id, registeredUserIds(augEventSlugs())))!;
    case "not_registered_aug":
      return and(notOptedOut, notInArray(users.id, registeredUserIds(augEventSlugs())))!;
    default: {
      // `registered:<slug>` — parseUserSegment guarantees the slug is known.
      const slug = segment.slice("registered:".length);
      return and(notOptedOut, inArray(users.id, registeredUserIds([slug])))!;
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
 * Every offered segment with its live recipient count, in picker order. The
 * per-event `registered:<slug>` options are enumerated from the individual
 * registry so each concrete event is directly targetable.
 */
export async function describeUserSegments(): Promise<SegmentOption[]> {
  const base: { value: UserSegment; label: string }[] = [
    { value: "all", label: "All users" },
    { value: "first_event_attended", label: "First event · attended" },
    { value: "first_event_no_show", label: "First event · no-show" },
    { value: "registered_any_aug", label: "Registered for any Aug event" },
    { value: "not_registered_aug", label: "Not registered for any Aug event" },
    ...getIndividualEvents().map((e) => ({
      value: `registered:${e.slug}` as UserSegment,
      label: `Registered · ${e.shortDate}`,
    })),
  ];
  return Promise.all(
    base.map(async (o) => ({ ...o, count: await countUserSegment(o.value) })),
  );
}
