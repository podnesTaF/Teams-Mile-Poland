import { and, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { eventEmailLog, eventRegistrations } from "@/db/schema";
import { requireAdmin } from "@/features/admin/action-helpers";
import { AdminFlash } from "@/features/admin/components/admin-flash";
import { EventDeletePanel } from "@/features/admin/components/event-delete-panel";
import { EventForm, type EventFormValues } from "@/features/admin/components/event-form";
import { EventStatusControl } from "@/features/admin/components/event-status-control";
import { FlashBanner } from "@/features/admin/components/flash-banner";
import { NoDatabaseNotice } from "@/features/admin/components/no-database-notice";
import { ADMIN_NOTE, ADMIN_TITLE, adminCard } from "@/features/admin/components/shell/admin-card";
import { AdminNotice } from "@/features/admin/components/shell/admin-notice";
import { updateEvent } from "@/features/admin/event-actions";
import { heatsOutsideWindow } from "@/features/admin/event-schemas";
import { countEventAttachedRows } from "@/features/admin/events-data";
import { remindersSentNotice, type FlashQuery } from "@/features/admin/flash";
import { plural } from "@/features/admin/format";
import { getEventHeats } from "@/features/admin/heats-data";
import { EVENT_SCHEDULED_KINDS } from "@/features/event-mailings/schedule";
import { getDb } from "@/lib/db";
import { getBibPool, getEventBySlug } from "@/lib/events/registry";
import {
  DEFAULT_BIB_POOL,
  DEFAULT_HEAT_INTERVAL_MINUTES,
  type EventSummary,
} from "@/lib/events/types";
import { cn } from "@/lib/utils";

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
  /** Every flash param the three event actions redirect back with. */
  searchParams: Promise<FlashQuery>;
};

/**
 * The Settings tab: the three things you do to an event rather than to its
 * runners — move it through its lifecycle, correct its details, or delete it.
 *
 * Wholly an `edit` surface, so it gates like the news editor rather than like
 * its sibling tabs: `requireAdmin(locale, "edit")` and a 404 below that, because
 * every panel on it is a control and there is nothing here a viewer would read.
 * (The tab itself is not gated — see `shell/event-tabs.tsx`.)
 *
 * It carries one thing no action can hand it: the warning that scheduled mail
 * has already gone out for this event. A reminder cannot be un-sent, so the
 * admin has to be told *before* moving the date, on a plain page load — this
 * page owns that read, and `flash.ts` owns the sentence.
 */
export default async function AdminEventSettingsPage({ params, searchParams }: PageProps) {
  const { locale, slug } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  await requireAdmin(locale, "edit");

  const event = await getEventBySlug(slug);
  if (!event || event.eventType !== "individual") notFound();

  if (!process.env.DATABASE_URL) {
    return (
      <NoDatabaseNotice>change this event&apos;s status, details or existence</NoDatabaseNotice>
    );
  }

  const [bibPool, sentKinds, counts, heats] = await Promise.all([
    // The pool the flash copy needs to bound its refusal sentences; `flash.ts`
    // stays synchronous, so the page resolves it — as its sibling tabs do.
    getBibPool(slug),
    sentScheduledKinds(slug),
    countEventAttachedRows(slug),
    getEventHeats(slug),
  ]);
  const reminders = remindersSentNotice(sentKinds);

  // Two conditions an *earlier* save can have left behind, which no flash can
  // report because they outlive the redirect that would have carried it: a card
  // claiming more lanes than the pool has chips, and heats sitting outside the
  // window. Both are consequences of the rule that editing an event never
  // re-times or resizes a heat — so they are standing notices next to the form
  // that caused them, not refusals, and the fix for both is on the Heats tab.
  const cardCapacity = heats.reduce((sum, heat) => sum + heat.capacity, 0);
  const strandedHeats = heatsOutsideWindow(heats, event);

  return (
    <>
      <AdminFlash query={query} context={{ slug, bibPool }} />

      {reminders ? <FlashBanner tone={reminders.tone} message={reminders.message} /> : null}

      <section className={adminCard("p-4 sm:p-5")}>
        <h2 className={ADMIN_TITLE}>Lifecycle</h2>
        <p className={cn(ADMIN_NOTE, "mt-1.5 max-w-[78ch]")}>
          What the public site does with this event, and the moves that are legal from where it is
          now. Each one takes effect on the next request — the event page, the landing and the
          register button all re-read it, with no deploy.
        </p>
        <div className="mt-4">
          <EventStatusControl locale={locale} slug={slug} status={event.status} />
        </div>
      </section>

      <section className={adminCard("mt-4 p-4 sm:p-5")}>
        <h2 className={ADMIN_TITLE}>Details</h2>
        <p className={cn(ADMIN_NOTE, "mt-1.5 max-w-[78ch]")}>
          Facts the public event page and the landing card state. Saving them changes what is shown
          on the next request; it does not move anything already generated from them — heat times
          are stored, and mail already sent stays sent.
        </p>

        {cardCapacity > bibPool ? (
          <AdminNotice className="mt-3">
            {plural(heats.length, "heat")} on the card total {cardCapacity} lanes against a{" "}
            {bibPool}-bib pool. Nobody can be handed a bib the pool does not have — check-in and
            heat generation both bound against the live pool — so this is a planning mismatch, not a
            broken card: a heat&apos;s capacity is its own stored number, and shrinking the pool did
            not shrink it. Resize the heats from the Heats tab, or put the pool back.
          </AdminNotice>
        ) : null}

        {strandedHeats.length > 0 ? (
          <AdminNotice className="mt-3">
            {strandedHeats.length === 1
              ? `Heat ${strandedHeats[0]} sits`
              : `Heats ${strandedHeats.join(", ")} sit`}{" "}
            outside the saved window — a different day, or a time before racing opens or after the
            window closes. Heat start times are stored instants and did not move when the window
            did. Re-time them from the Heats tab, or delete and regenerate the card.
          </AdminNotice>
        ) : null}

        <div className="mt-4">
          <EventForm
            action={updateEvent}
            locale={locale}
            slug={slug}
            initial={toFormValues(event)}
            submitLabel="Save details"
          />
        </div>
      </section>

      <EventDeletePanel locale={locale} slug={slug} counts={counts} />
    </>
  );
}

/** The stored event as the form's fields. */
function toFormValues(event: EventSummary): EventFormValues {
  return {
    name: event.name,
    date: event.date,
    startTime: event.timeRange?.start ?? "",
    endTime: event.timeRange?.end ?? "",
    venue: event.venue,
    city: event.city,
    eventType: event.eventType ?? "individual",
    bibPool: event.bibPool ?? DEFAULT_BIB_POOL,
    heatIntervalMinutes: event.heatIntervalMinutes ?? DEFAULT_HEAT_INTERVAL_MINUTES,
  };
}

/**
 * Which of the four date-derived kinds have actually left the building for this
 * event — the input to the standing reminders warning.
 *
 * `event_email_log` has no slug of its own: a row hangs off a registration, so
 * the event comes in over the join. Restricted to `sent` (a `failed` row is a
 * mail nobody received, and re-arming it is the chain's business, not this
 * warning's) and to the four scheduled kinds, because those are the ones derived
 * from the date — `confirmation`, `media_live` and `heat_assignment` are not, and
 * naming them here would suggest moving the date affected them.
 *
 * Returned in chain order rather than query order, so the sentence reads the way
 * the chain runs.
 */
async function sentScheduledKinds(slug: string): Promise<readonly string[]> {
  const rows = await getDb()
    .selectDistinct({ kind: eventEmailLog.kind })
    .from(eventEmailLog)
    .innerJoin(eventRegistrations, eq(eventEmailLog.eventRegistrationId, eventRegistrations.id))
    .where(
      and(
        eq(eventRegistrations.eventSlug, slug),
        eq(eventEmailLog.status, "sent"),
        inArray(eventEmailLog.kind, [...EVENT_SCHEDULED_KINDS]),
      ),
    );
  const sent = new Set<string>(rows.map((row) => row.kind));
  return EVENT_SCHEDULED_KINDS.filter((kind) => sent.has(kind));
}

