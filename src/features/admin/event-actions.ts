"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { events } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getEventBySlug } from "@/lib/events/registry";
import { DEFAULT_BIB_POOL, type EventStatus, type TimeRange } from "@/lib/events/types";

import { adminPath, requireAdmin, safeLocale } from "./action-helpers";
import {
  canTransition,
  eventFieldsSchema,
  eventTypeSchema,
  eventWindowSchema,
  heatsOutsideWindow,
  isEventStatus,
  isPastEventDate,
  windowRequired,
  type EventFields,
  type EventWindow,
} from "./event-schemas";
import { generateEventSlug } from "./event-slug";
import {
  countEventAttachedRows,
  getEventRoster,
  getRosterStats,
  holdsBib,
  isUniqueViolation,
  type EventAttachedCounts,
} from "./events-data";
import { revalidateEventSurfaces } from "./events-revalidate";
import { getEventHeats } from "./heats-data";

/**
 * The four event mutations: create, edit, delete, and move the lifecycle.
 *
 * Form-post server actions in the `news-actions.ts` shape — validate, mutate,
 * revalidate, then `redirect` back to the page the form was on carrying a short
 * flash code (`?ok=eventupdated`, `?error=bibpool_in_use`). The sentences live in
 * `flash.ts`; nothing here writes prose, and every refusal is a redirect rather
 * than a thrown error, because an admin who mistyped a bib pool needs a page
 * with an explanation on it, not an error boundary.
 *
 * Three rules shape the whole module.
 *
 * **The gate is `edit` on all four.** Moving an event's lifecycle is not a
 * check-in desk action and not a viewer action: `registration_open` is what
 * points the landing's Register button at a night, and `cancelled` is what tells
 * the world a race is off. `requireAdmin` 404s anything below `edit`, so a
 * hand-posted form from a volunteer's session gets the same answer as browsing
 * to a page they cannot see.
 *
 * **The slug is written once and never again.** `createEvent` mints it from the
 * date; `updateEvent` does not name the column. Six things key off `event_slug`
 * as bare text with no foreign key — `event_registrations`, `event_results`,
 * `event_heats`, `event_media`, `event_email_log` and the signed ticket payload
 * — so a rename does not cascade, it *strands*: the rows simply stop matching,
 * silently, and a runner's QR stops resolving to their entry. The last rename in
 * this project moved 11 registrations by hand. The accepted consequence, stated
 * here because the settings page states it too: **an event whose date is edited
 * keeps a slug naming the old date.** `mile-2026-09-05` moved to the 12th stays
 * `mile-2026-09-05`. The slug is a join key that happens to read like a date;
 * every surface renders `EventSummary.date`, so a stale slug is cosmetic where a
 * fresh one is six tables of orphans.
 *
 * **Editing an event never re-times anything that already exists.** Heat
 * `scheduledAt` is a stored instant written from the generator's own fields, and
 * a logged email is a record of what left the building. So an edit moves the
 * event's facts and reports what it has left behind — heats now outside the
 * window come back as `?heatsoutside=` — rather than reaching into either. In
 * particular there is deliberately **no mail logic here at all**: a date move
 * cannot make several reminders due at once (only the latest passed kind is ever
 * due), and a date pushed out cannot un-send the reminders already logged, so
 * the honest place for that fact is a standing notice on the settings page
 * (`remindersSentNotice`), not a mutation that silently re-arms or suppresses
 * sends behind the admin's back.
 */

/* ── where a refusal or a confirmation lands ─────────────────────────── */

function eventsPath(locale: string, query = ""): string {
  return adminPath(locale, `/events${query}`);
}

/**
 * The slug is encoded, not trusted. Two of the refusals below fire *before* the
 * slug has been resolved to a row — a post with an unknown status, a mistyped
 * confirmation — so the value going into the path is still whatever was
 * submitted, and `../..` in a redirect target would send the admin somewhere
 * else entirely. A real slug (`mile-2026-08-29`) encodes to itself.
 */
function settingsPath(locale: string, slug: string, query = ""): string {
  return adminPath(locale, `/events/${encodeURIComponent(slug)}/settings${query}`);
}

/**
 * Back to the event's settings page — where three of the four forms live, so it
 * is where both their confirmations and their refusals belong.
 */
function backToSettings(locale: string, slug: string, params: string): never {
  redirect(settingsPath(locale, slug, `?${params}`));
}

/**
 * Back to the events index. Used when there is no event to return *to*: a post
 * with no slug, a slug that resolves to nothing, and the successful delete.
 */
function backToIndex(locale: string, params: string): never {
  redirect(eventsPath(locale, `?${params}`));
}

/* ── reading the form ────────────────────────────────────────────────── */

function field(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/**
 * The window the form submitted, or `"invalid"`.
 *
 * A blank window is `null` — legal only where {@link windowRequired} says so
 * (the legacy team format), and stored as two nulls, which is what the column
 * nullability exists for. A *partly* filled window is always invalid: one time
 * is not a window, and guessing the other end would invent a race duration.
 */
function readWindow(formData: FormData, required: boolean): EventWindow | null | "invalid" {
  const startTime = field(formData, "startTime");
  const endTime = field(formData, "endTime");
  if (!startTime && !endTime) return required ? "invalid" : null;
  const parsed = eventWindowSchema.safeParse({ startTime, endTime });
  return parsed.success ? parsed.data : "invalid";
}

/** The shared, non-window fields the form submitted, or null when any is bad. */
function readFields(formData: FormData): EventFields | null {
  const parsed = eventFieldsSchema.safeParse({
    name: field(formData, "name"),
    date: field(formData, "date"),
    venue: field(formData, "venue"),
    city: field(formData, "city"),
    bibPool: field(formData, "bibPool"),
    heatIntervalMinutes: field(formData, "heatIntervalMinutes"),
  });
  return parsed.success ? parsed.data : null;
}

/** `&past=1` when the saved date is behind us — allowed, and worth saying. */
function pastCaveat(date: string): string {
  return isPastEventDate(date) ? "&past=1" : "";
}

/* ── the guards that need the database ───────────────────────────────── */

/**
 * The highest bib currently out on loan for an event, or 0 when none is.
 *
 * Reads the roster and asks `holdsBib` of each row rather than adding a seventh
 * query that knows what a held bib is: a bib is a *lease* (ADR 0003), held while
 * `bib` is set and `bib_returned_at` is not, and that predicate already has one
 * home. A returned number is deliberately not counted — it is history the roster
 * still shows, and shrinking the pool past it strands nothing.
 *
 * The roster read excludes the deprecated `cancelled` participation status,
 * which is never written, so nothing that could hold a lease is missed.
 */
async function highestHeldBib(slug: string): Promise<number> {
  const roster = await getEventRoster(slug);
  return roster.reduce((max, row) => (holdsBib(row) ? Math.max(max, row.bib ?? 0) : max), 0);
}

/** `registrations=3&heats=1` — only the counts that are actually non-zero. */
function attachedParams(counts: EventAttachedCounts): string {
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([key, n]) => `&${key}=${n}`)
    .join("");
}

/**
 * How many entrants would be left un-arrived by marking an event completed:
 * everyone who is neither `checked_in` nor `no_show`.
 *
 * Both `registered` and `confirmed` count. `confirmed` is the *stronger* signal
 * — the runner said they were coming — so leaving it out would under-report the
 * exact thing the guard rail is about: a night marked run with nobody having
 * been through the desk, which usually means the desk was never used and the
 * roster now needs marking up by hand.
 *
 * Reuses the roster header's own counts, which are request-cached, rather than
 * asking the same question a second way.
 */
async function stillToArrive(slug: string): Promise<number> {
  const stats = await getRosterStats(slug);
  return stats.registered + stats.confirmed;
}

/* ── the four actions ────────────────────────────────────────────────── */

/**
 * Move an event along its lifecycle: `locale`, `slug`, `status`.
 *
 * The transition is validated against `EVENT_TRANSITIONS` — the same table the
 * settings page renders its buttons from, so an illegal move only arrives from a
 * stale tab or a crafted post, and gets `?error=transition` naming the move it
 * turned down rather than a thrown error.
 *
 * One legal move carries a warning with it. Marking an event `completed` while
 * entrants are still waiting to arrive is allowed (a night can be run with the
 * desk on paper, and the status is about the race, not the roster) but comes back
 * with `?registered=<count>`, because the alternative is an event that reads as
 * finished with a roster that reads as if nobody turned up.
 *
 * `cancelled` is deliberately reachable from every state except `completed`, and
 * is *not* a delete: the roster, heats and results stay on the record and the
 * public page keeps rendering, with the cancelled notice instead of a register
 * CTA. That is the state the 2026-08-08 night needed and did not have.
 */
export async function setEventStatus(formData: FormData): Promise<void> {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale, "edit");

  const slug = field(formData, "slug");
  if (!slug) backToIndex(locale, "error=input");

  const to = formData.get("status");
  if (!isEventStatus(to)) backToSettings(locale, slug, "error=input");

  const event = await getEventBySlug(slug);
  if (!event) backToIndex(locale, "error=input");
  const from: EventStatus = event.status;

  if (!canTransition(from, to)) {
    backToSettings(locale, slug, `error=transition&from=${from}&to=${to}`);
  }

  // Only asked where it is the point: every other move leaves the roster's
  // meaning untouched, and this is a query per press.
  const waiting = to === "completed" ? await stillToArrive(slug) : 0;

  await getDb()
    .update(events)
    .set({ status: to, updatedAt: new Date() })
    .where(eq(events.slug, slug));

  revalidateEventSurfaces(locale, slug);
  backToSettings(
    locale,
    slug,
    `ok=statuschanged&status=${to}${waiting > 0 ? `&registered=${waiting}` : ""}`,
  );
}

/**
 * Create an event: `locale`, `name`, `date`, `startTime`, `endTime`, `venue`,
 * `city`, `eventType`, `bibPool`, `heatIntervalMinutes`.
 *
 * **Always lands as `draft`**, which is why `status` is not a form field. An
 * unannounced event is the only safe default: a draft 404s on every public
 * surface and is absent from the landing, so a half-filled night cannot be
 * advertised by a stray click, and announcing it is a separate, deliberate press
 * of the status control. `createdBy` records who made it.
 *
 * The slug is minted here and only here, from the date, and is the row's primary
 * key. `generateEventSlug` fails loudly when the database is unreachable instead
 * of guessing — a slug that cannot be verified as unique is not a degraded
 * answer but a plausible one, and it would hand a second event the join key of
 * the first.
 *
 * A date in the past is accepted (back-filling a night that already ran) and
 * comes back with `?past=1`. The caveat is about the slug and the public page,
 * not about mail: a back-filled event is never due for any scheduled kind.
 */
export async function createEvent(formData: FormData): Promise<void> {
  const locale = safeLocale(formData.get("locale"));
  const actor = await requireAdmin(locale, "edit");

  const newPath = eventsPath(locale, "/new");
  function backToForm(params: string): never {
    redirect(`${newPath}?${params}`);
  }

  const eventType = eventTypeSchema.safeParse(field(formData, "eventType"));
  const fields = readFields(formData);
  if (!eventType.success || !fields) backToForm("error=input");

  const timeWindow = readWindow(formData, windowRequired(eventType.data));
  if (timeWindow === "invalid") backToForm("error=invalid_window");

  const values = {
    status: "draft" as const,
    eventType: eventType.data,
    name: fields.name,
    date: fields.date,
    startTime: timeWindow?.startTime ?? null,
    endTime: timeWindow?.endTime ?? null,
    venue: fields.venue,
    city: fields.city,
    bibPool: fields.bibPool,
    heatIntervalMinutes: fields.heatIntervalMinutes,
    createdBy: actor.id,
  };

  // The slug is read-then-written, so two admins creating a night on the same
  // date in the same moment can both derive the same one. One retry against a
  // freshly read table settles that; a second collision is not a race any more
  // and is left to surface, because a mutation that cannot name its row must not
  // pretend it succeeded.
  let slug = await generateEventSlug(fields.date);
  try {
    await getDb()
      .insert(events)
      .values({ slug, ...values });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    slug = await generateEventSlug(fields.date);
    await getDb()
      .insert(events)
      .values({ slug, ...values });
  }

  revalidateEventSurfaces(locale, slug);
  backToSettings(locale, slug, `ok=eventcreated${pastCaveat(fields.date)}`);
}

/**
 * Edit an event's facts: `locale`, `slug`, `name`, `date`, `startTime`,
 * `endTime`, `venue`, `city`, `bibPool`, `heatIntervalMinutes`.
 *
 * Three columns are conspicuously absent. **`slug`** is immutable (see the
 * module docblock). **`status`** moves through {@link setEventStatus}, so the
 * lifecycle is never a side effect of saving a venue typo. **`event_type`** is as
 * fixed as the slug: the format decides which registration flow, roster and
 * results shape the slug's rows already assume.
 *
 * One refusal and one warning, and the difference between them is whether the
 * save could make a *lie* true:
 *
 * - **Shrinking the bib pool below a bib somebody is holding is refused**
 *   (`?error=bibpool_in_use&bib=<highest>`). Bibs are leases drawn from
 *   `1..bibPool` (ADR 0003), and every check-in and heat guard bounds against
 *   the live pool — so a pool of 20 with bib 37 out on the track is a number
 *   nothing in the system can account for.
 * - **Heats left outside the new window are only counted**
 *   (`?heatsoutside=<n>`). Their times are stored facts that this save did not
 *   and must not move, and an admin mid-reschedule legitimately moves the date
 *   first and re-times the card second. Refusing would make the two-step
 *   reschedule impossible in the order the UI supports.
 */
export async function updateEvent(formData: FormData): Promise<void> {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale, "edit");

  const slug = field(formData, "slug");
  if (!slug) backToIndex(locale, "error=input");

  const event = await getEventBySlug(slug);
  if (!event) backToIndex(locale, "error=input");

  const fields = readFields(formData);
  if (!fields) backToSettings(locale, slug, "error=input");

  // The format is the stored one, never the form's: it decides whether a window
  // is required, and it is not editable.
  const eventType = event.eventType ?? "team";
  const timeWindow = readWindow(formData, windowRequired(eventType));
  if (timeWindow === "invalid") backToSettings(locale, slug, "error=invalid_window");

  // Only a shrink can strand a lease, and only then is the roster worth reading:
  // leases are bounded by the pool at every site that issues one, so growing it
  // or leaving it alone cannot put a held bib out of range.
  if (fields.bibPool < (event.bibPool ?? DEFAULT_BIB_POOL)) {
    const highest = await highestHeldBib(slug);
    if (fields.bibPool < highest) {
      backToSettings(locale, slug, `error=bibpool_in_use&bib=${highest}&pool=${fields.bibPool}`);
    }
  }

  await getDb()
    .update(events)
    .set({
      name: fields.name,
      date: fields.date,
      startTime: timeWindow?.startTime ?? null,
      endTime: timeWindow?.endTime ?? null,
      venue: fields.venue,
      city: fields.city,
      bibPool: fields.bibPool,
      heatIntervalMinutes: fields.heatIntervalMinutes,
      updatedAt: new Date(),
    })
    .where(eq(events.slug, slug));

  // Counted against what was just saved, not against the store: the event read
  // above is a request-cached snapshot from before this update. The stored
  // `HH:MM` pair becomes a display `TimeRange` here, the same mapping
  // `toSummary` does — the predicate is about the window an admin sees.
  const savedWindow: TimeRange | undefined = timeWindow
    ? { start: timeWindow.startTime, end: timeWindow.endTime }
    : undefined;
  const stranded = savedWindow
    ? heatsOutsideWindow(await getEventHeats(slug), {
        date: fields.date,
        timeRange: savedWindow,
      }).length
    : 0;

  revalidateEventSurfaces(locale, slug);
  backToSettings(
    locale,
    slug,
    `ok=eventupdated${pastCaveat(fields.date)}${stranded > 0 ? `&heatsoutside=${stranded}` : ""}`,
  );
}

/**
 * Delete an event for good: `locale`, `slug`, `confirmSlug`.
 *
 * **Hard delete, and only while the event is empty.** Allowed when all five
 * slug-keyed tables hold nothing for it — `event_registrations`,
 * `event_results`, `event_heats`, `event_media`, `event_email_log`. On any
 * non-zero count the refusal comes back as `?error=not_empty` with the counts,
 * whose sentence points at the real answer: **cancel it instead.** There is no
 * foreign key behind the slug, so deleting a night people entered would not
 * cascade and would not fail — it would leave their registrations, tickets and
 * results keyed to a slug nothing resolves. Cancelling keeps every one of those
 * rows and still tells the world the race is off.
 *
 * So this is the one path for the case it is actually for: a draft created by
 * mistake, or a night that was never announced, disappearing cleanly.
 *
 * `confirmSlug` is the slug typed out by hand. A destructive, irreversible
 * action gets a confirmation the admin has to *read the page* to satisfy, not
 * one a double-click can clear.
 */
export async function deleteEvent(formData: FormData): Promise<void> {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale, "edit");

  const slug = field(formData, "slug");
  if (!slug) backToIndex(locale, "error=input");

  // Compared to the submitted slug, not to a resolved event: the point is that
  // the admin typed this event's name, and a mismatch is answered before
  // anything is counted or read.
  if (field(formData, "confirmSlug") !== slug) backToSettings(locale, slug, "error=input");

  const counts = await countEventAttachedRows(slug);
  const attached = attachedParams(counts);
  if (attached) backToSettings(locale, slug, `error=not_empty${attached}`);

  // `returning` is the existence check: an empty result means the row is already
  // gone (another tab got there first), and saying so beats confirming a delete
  // that did nothing.
  const deleted = await getDb()
    .delete(events)
    .where(eq(events.slug, slug))
    .returning({ slug: events.slug });
  if (deleted.length === 0) backToIndex(locale, "error=input");

  revalidateEventSurfaces(locale, slug);
  backToIndex(locale, "ok=eventdeleted");
}
