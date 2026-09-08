import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";

import {
  consentSubmissions,
  type ConsentSnapshot,
  type ConsentSubmissionRow,
  eventHeats,
  eventRegistrations,
  registrationConsents,
  type RegistrationConsentRow,
  users,
} from "@/db/schema";
import { getDb } from "@/lib/db";
import type { ConsentRowInput } from "@/lib/legal/consent";
import type { DocSet, DocSlug } from "@/lib/legal/manifest";

export type EventRegistrationRow = typeof eventRegistrations.$inferSelect;

/** Whether a user already has a registration for an event. */
export async function hasRegistration(eventSlug: string, userId: string): Promise<boolean> {
  return Boolean(await getRegistration(eventSlug, userId));
}

/** A user's registration for an event, or null. */
export async function getRegistration(
  eventSlug: string,
  userId: string,
): Promise<EventRegistrationRow | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(eventRegistrations)
    .where(and(eq(eventRegistrations.eventSlug, eventSlug), eq(eventRegistrations.userId, userId)))
    .limit(1);
  return row ?? null;
}

/** Input for a free registration row — the one shape both writers insert. */
export type FreeRegistrationInput = {
  eventSlug: string;
  userId: string;
  locale: string;
  /**
   * The deprecated `terms` boolean (ADR 0006). Defaults to `false` and is never
   * again written as a hardcoded `true`: the consent path derives it from the
   * set's `acceptance`-kind items, and a path that captures no consent at all —
   * an admin registering a runner by hand — leaves it false, which is the honest
   * value. Real acceptance lives in `registration_consents`.
   */
  terms?: boolean;
};

/** The column values of a free registration, shared by both insert paths. */
function freeRegistrationValues(input: FreeRegistrationInput) {
  return {
    eventSlug: input.eventSlug,
    userId: input.userId,
    status: "registered" as const,
    terms: input.terms ?? false,
    locale: input.locale,
  };
}

/**
 * Create a free registration for a user, with no consent record. Registration is
 * free and uncapped; the unique (event_slug, user_id) index is the only guard
 * against duplicates.
 *
 * The runner-facing path is {@link createRegistrationWithConsent} — this one
 * remains for the admin "register this user" action, where nobody ticked
 * anything and there is consequently nothing to record.
 */
export async function createFreeRegistration(
  input: FreeRegistrationInput,
): Promise<EventRegistrationRow> {
  const db = getDb();
  const [row] = await db
    .insert(eventRegistrations)
    .values(freeRegistrationValues(input))
    .returning();
  return row;
}

/**
 * Write a registration **and its consent evidence in one transaction** (ADR
 * 0006): the registration row, one `consent_submissions` row for the form
 * submission, and one `registration_consents` row per box ticked. A failure
 * anywhere — a duplicate registration, an unregistered document slug, a lost
 * connection — writes nothing at all, which is the invariant this feature
 * exists to establish: no registration without a signed statement.
 *
 * Ordering inside the transaction is forced by the FKs: the registration's id is
 * the submission's parent, the submission's id is every consent row's parent.
 */
export async function createRegistrationWithConsent(input: {
  registration: FreeRegistrationInput;
  submission: {
    docSet: DocSet;
    /** The language the documents were actually shown in. */
    locale: string;
    snapshot: ConsentSnapshot;
    ip: string | null;
    userAgent: string | null;
  };
  consents: ConsentRowInput[];
}): Promise<EventRegistrationRow> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [registration] = await tx
      .insert(eventRegistrations)
      .values(freeRegistrationValues(input.registration))
      .returning();

    const [submission] = await tx
      .insert(consentSubmissions)
      .values({
        registrationId: registration.id,
        docSet: input.submission.docSet,
        locale: input.submission.locale,
        snapshot: input.submission.snapshot,
        ip: input.submission.ip,
        userAgent: input.submission.userAgent,
      })
      .returning({ id: consentSubmissions.id });

    await tx.insert(registrationConsents).values(
      input.consents.map((c) => ({
        submissionId: submission.id,
        itemId: c.itemId,
        kind: c.kind,
        docSlug: c.docSlug as DocSlug,
        docVersion: c.docVersion,
        value: c.value,
      })),
    );

    return registration;
  });
}

/**
 * The runner's most recent consent snapshot, for prefilling the confirm step.
 *
 * Newest submission across all of *their* registrations, so a second race night
 * does not ask for the emergency contact again (user story 10). Read for prefill
 * only — the value written is whatever they submit this time, because the
 * snapshot is a record of a moment and is never edited in place.
 */
export async function getLatestConsentSnapshot(
  userId: string,
): Promise<ConsentSnapshot | null> {
  const db = getDb();
  const [row] = await db
    .select({ snapshot: consentSubmissions.snapshot })
    .from(consentSubmissions)
    .innerJoin(eventRegistrations, eq(consentSubmissions.registrationId, eventRegistrations.id))
    .where(eq(eventRegistrations.userId, userId))
    .orderBy(desc(consentSubmissions.acceptedAt))
    .limit(1);
  return row?.snapshot ?? null;
}

/** A registration's consent evidence: the submission plus its rows. */
export type ConsentRecord = {
  submission: ConsentSubmissionRow;
  consents: RegistrationConsentRow[];
};

/**
 * The consent evidence for one registration, newest submission first, or `null`
 * for a registration that predates the consent tables. **Null is a real answer**
 * (user story 26): the 197 historical registrations get no rows, and the surface
 * that reads this must say "no consent on record" rather than render a document
 * nobody accepted.
 *
 * Returns the latest submission only. Re-consent after a document re-issue
 * appends a second submission, and the operative one is the most recent.
 */
export async function getConsentRecord(registrationId: string): Promise<ConsentRecord | null> {
  const db = getDb();
  const [submission] = await db
    .select()
    .from(consentSubmissions)
    .where(eq(consentSubmissions.registrationId, registrationId))
    .orderBy(desc(consentSubmissions.acceptedAt))
    .limit(1);
  if (!submission) return null;
  const consents = await db
    .select()
    .from(registrationConsents)
    .where(eq(registrationConsents.submissionId, submission.id));
  return { submission, consents };
}

/** A user's registrations, newest first (enrich with registry data in the UI). */
export async function getUserRegistrations(userId: string): Promise<EventRegistrationRow[]> {
  const db = getDb();
  return db
    .select()
    .from(eventRegistrations)
    .where(eq(eventRegistrations.userId, userId))
    .orderBy(desc(eventRegistrations.createdAt));
}

/** A runner's heat as the profile card and the ticket page display it. */
export type PublishedHeatView = { number: number; scheduledAt: Date };

/**
 * Published heats for the given registrations, keyed by registration id.
 *
 * **Published only.** A draft heat is admin work-in-progress that the runner has
 * not been emailed about, and showing it would contradict the mailing the moment
 * an admin rebalanced the card (PRD #26). One query for a whole list, so the
 * profile page does not fan out per registration.
 *
 * The returned `scheduledAt` is the stored instant; callers format it as Warsaw
 * wall-clock via `formatHeatTime` and label it approximate.
 */
export async function publishedHeatsByRegistration(
  registrationIds: string[],
): Promise<Map<string, PublishedHeatView>> {
  const ids = [...new Set(registrationIds)];
  if (ids.length === 0) return new Map();

  const rows = await getDb()
    .select({
      registrationId: eventRegistrations.id,
      number: eventHeats.number,
      scheduledAt: eventHeats.scheduledAt,
    })
    .from(eventRegistrations)
    .innerJoin(eventHeats, eq(eventRegistrations.heatId, eventHeats.id))
    .where(and(inArray(eventRegistrations.id, ids), isNotNull(eventHeats.publishedAt)));

  return new Map(rows.map((r) => [r.registrationId, { number: r.number, scheduledAt: r.scheduledAt }]));
}

/** One runner who refused image use — enough identity to check a gallery against. */
export type ImageUseRefusal = {
  registrationId: string;
  /** Null when no bib was ever issued (a lease, not an identity — ADR 0003). */
  bib: number | null;
  /** From the consent snapshot's `fullName` — the evidence of record, not the live profile. */
  name: string;
};

/**
 * Runners registered for `eventSlug` whose **latest** consent submission carries
 * an `imageUse` row with value `"disagree"` and no withdrawal (PRD #50 user
 * story 24 / issue #56). `event_media` publishes a whole Drive folder with no
 * per-runner exclusion, so this is an operational promise, not a technical
 * gate: it surfaces who refused next to the publish action so a human can
 * check the gallery before it goes live. Publishing itself is unchanged and is
 * not blocked by this list.
 *
 * "Latest" matters, not "ever": a runner who re-consented and flipped to
 * "agree" must not appear here just because an older submission once refused.
 * `DISTINCT ON (registration_id)` picks each registration's newest submission
 * — ordered by `accepted_at desc` — before the `imageUse` / `disagree` filter
 * is applied, so a superseded refusal is excluded and a superseded agreement
 * does not hide a live refusal either.
 *
 * The `itemId` + `value` equality is the indexed lookup from #53
 * (`registration_consents_consent_value_idx`, partial `where kind = 'consent'`);
 * the explicit `kind` equality here matches that partial predicate.
 *
 * Registrations that predate consent capture have no submission at all and are
 * simply absent from the result — their absence is not itself evidence of
 * anything, refusal or otherwise.
 */
export async function getImageUseRefusals(eventSlug: string): Promise<ImageUseRefusal[]> {
  const db = getDb();

  const latestSubmission = db
    .selectDistinctOn([consentSubmissions.registrationId], {
      registrationId: consentSubmissions.registrationId,
      submissionId: consentSubmissions.id,
      snapshot: consentSubmissions.snapshot,
    })
    .from(consentSubmissions)
    .orderBy(consentSubmissions.registrationId, desc(consentSubmissions.acceptedAt))
    .as("latest_submission");

  const rows = await db
    .select({
      registrationId: eventRegistrations.id,
      bib: eventRegistrations.bib,
      snapshot: latestSubmission.snapshot,
    })
    .from(eventRegistrations)
    .innerJoin(latestSubmission, eq(latestSubmission.registrationId, eventRegistrations.id))
    .innerJoin(
      registrationConsents,
      and(
        eq(registrationConsents.submissionId, latestSubmission.submissionId),
        eq(registrationConsents.itemId, "imageUse"),
        eq(registrationConsents.kind, "consent"),
        eq(registrationConsents.value, "disagree"),
        isNull(registrationConsents.withdrawnAt),
      ),
    )
    .where(eq(eventRegistrations.eventSlug, eventSlug));

  return rows.map((r) => ({
    registrationId: r.registrationId,
    bib: r.bib,
    name: r.snapshot.fullName,
  }));
}

/** Load one registration joined with its user, for ticket rendering. */
export async function loadEventRegistration(registrationId: string): Promise<
  | { registration: EventRegistrationRow; user: typeof users.$inferSelect }
  | null
> {
  const db = getDb();
  const [row] = await db
    .select({ registration: eventRegistrations, user: users })
    .from(eventRegistrations)
    .innerJoin(users, eq(eventRegistrations.userId, users.id))
    .where(eq(eventRegistrations.id, registrationId))
    .limit(1);
  return row ?? null;
}
