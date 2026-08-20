import { adminButton } from "@/features/admin/components/shell/admin-button";
import { ADMIN_NOTE } from "@/features/admin/components/shell/admin-card";
import { AdminField, adminInput } from "@/features/admin/components/shell/admin-field";
import { DEFAULT_VENUE, EVENING, MORNING } from "@/lib/events/registry";
import {
  DEFAULT_BIB_POOL,
  DEFAULT_HEAT_INTERVAL_MINUTES,
  type EventType,
} from "@/lib/events/types";
import { cn } from "@/lib/utils";

import { EventWindowFields, type WindowPreset } from "./event-window-fields";

/**
 * The one field set an event is written from — shared by `/admin/events/new`
 * (posting `createEvent`) and the Settings tab (posting `updateEvent`), so the
 * two forms cannot drift into asking for different things.
 *
 * Two fields exist on the create form only, and both are immutable once the row
 * exists: the **slug**, which is generated from the date and is the only thing
 * tying six tables' rows to this event, and the **event type**, which decides
 * which registration flow the public page links to. On the edit form the slug is
 * shown read-only with the reason, and the type is not shown at all.
 *
 * Everything about validation stays server-side. The `required` / `min` / `type`
 * attributes here are the browser being helpful about obvious mistakes; the
 * refusals that matter (a bib pool below a bib in use, a window with the start
 * after the end, a slug collision) belong to the actions and come back as
 * flashes.
 *
 * A server component, deliberately: it reads the window and venue defaults from
 * `@/lib/events/registry`, which reaches the database driver and cannot bundle
 * for the browser. Only the window — presets plus the generated-timetable
 * preview — is a client island.
 */

export type EventFormValues = {
  name: string;
  /** ISO `YYYY-MM-DD`, as the `date` input wants it. */
  date: string;
  startTime: string;
  endTime: string;
  venue: string;
  city: string;
  eventType: EventType;
  bibPool: number;
  heatIntervalMinutes: number;
};

/**
 * Every row in the series carries the same name; it is a form default rather
 * than a constant anywhere else because a differently-named night is a thing an
 * admin is allowed to create.
 */
const DEFAULT_EVENT_NAME = "Individual Mile";

/**
 * What a fresh event starts as: the series' own name, venue and morning window,
 * the RaceResult bib pool and the standard heat spacing. The date is left empty
 * on purpose — it is the one fact nobody can guess, and it is what the slug is
 * generated from.
 */
export const NEW_EVENT_DEFAULTS: EventFormValues = {
  name: DEFAULT_EVENT_NAME,
  date: "",
  startTime: MORNING.start,
  endTime: MORNING.end,
  venue: DEFAULT_VENUE.venue,
  city: DEFAULT_VENUE.city,
  eventType: "individual",
  bibPool: DEFAULT_BIB_POOL,
  heatIntervalMinutes: DEFAULT_HEAT_INTERVAL_MINUTES,
};

/** The two patterns the series alternates between — one press each. */
const WINDOW_PRESETS: readonly WindowPreset[] = [
  { label: "Morning", start: MORNING.start, end: MORNING.end },
  { label: "Evening", start: EVENING.start, end: EVENING.end },
];

type EventFormProps = {
  /** `createEvent` or `updateEvent`. */
  action: (formData: FormData) => void | Promise<void>;
  locale: string;
  /**
   * The event's slug on the edit form: posted back in a hidden input, shown
   * read-only beside its explanation. Omit for the create form — the slug is
   * generated there, from the date.
   */
  slug?: string;
  /** Pre-filled values on edit; defaults to {@link NEW_EVENT_DEFAULTS}. */
  initial?: EventFormValues;
  submitLabel: string;
};

export function EventForm({
  action,
  locale,
  slug,
  initial = NEW_EVENT_DEFAULTS,
  submitLabel,
}: EventFormProps) {
  const editing = slug !== undefined;

  return (
    <form action={action} data-event-form={editing ? "edit" : "create"}>
      <input type="hidden" name="locale" value={locale} />
      {editing ? <input type="hidden" name="slug" value={slug} /> : null}

      {editing ? (
        <div className="mb-4">
          <AdminField label="Slug — permanent" className="max-w-[320px]">
            <input className={adminInput()} type="text" value={slug} readOnly disabled />
          </AdminField>
          <p className={cn(ADMIN_NOTE, "mt-1.5 max-w-[78ch]")}>
            The slug is generated once, at creation, and never rewritten. Six things key off it as
            plain text with no foreign key — registrations, results, heats, the gallery, the email
            log and the signature baked into every issued ticket — so renaming it would strand those
            rows rather than move them. The last slug rename in this project was eleven
            registrations re-keyed by hand. A consequence worth knowing: move the date after
            creation and the slug keeps naming the old one. That is accepted, and the date below is
            what the public page shows.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField label="Name">
          <input
            className={adminInput()}
            type="text"
            name="name"
            required
            maxLength={120}
            defaultValue={initial.name}
            data-event-name
          />
        </AdminField>

        <div>
          <AdminField label="Date" className="max-w-[190px]">
            <input
              className={adminInput()}
              type="date"
              name="date"
              required
              defaultValue={initial.date}
              data-event-date
            />
          </AdminField>
          <p className={cn(ADMIN_NOTE, "mt-1.5")}>
            {editing
              ? "Saved dates in the past are allowed and warned about; the slug does not follow a move."
              : "The slug is generated from this date as mile-YYYY-MM-DD. A date in the past is allowed, for back-filling a night that already ran, and is warned about on save."}
          </p>
        </div>

        <AdminField label="Venue">
          <input
            className={adminInput()}
            type="text"
            name="venue"
            required
            maxLength={120}
            defaultValue={initial.venue}
          />
        </AdminField>
        <AdminField label="City">
          <input
            className={adminInput()}
            type="text"
            name="city"
            required
            maxLength={80}
            defaultValue={initial.city}
          />
        </AdminField>

        {editing ? null : (
          <div className="sm:col-span-2">
            <AdminField label="Event type" className="max-w-[220px]">
              <select
                className={adminInput()}
                name="eventType"
                defaultValue={initial.eventType}
                data-event-type
              >
                <option value="individual">individual</option>
                <option value="team">team</option>
              </select>
            </AdminField>
            <p className={cn(ADMIN_NOTE, "mt-1.5 max-w-[78ch]")}>
              Pick <strong className="font-semibold text-admin-ink-2">individual</strong> unless you
              know otherwise: that is the mile series — per-person entry, bibs, heats, check-in.{" "}
              <strong className="font-semibold text-admin-ink-2">team</strong> is the legacy TEAMS
              MILE format and{" "}
              <strong className="font-semibold text-admin-ink-2">
                has no working registration flow
              </strong>
              : nobody can enter it, and it gets no roster, heats, check-in or settings pages
              either. It is selectable so an old-format night can be recorded, not so one can be
              run. This cannot be changed after creation.
            </p>
          </div>
        )}

        <div className="sm:col-span-2">
          <EventWindowFields
            start={initial.startTime}
            end={initial.endTime}
            presets={WINDOW_PRESETS}
          />
        </div>

        <div>
          <AdminField label="Bib pool" className="max-w-[130px]">
            <input
              className={adminInput()}
              type="number"
              name="bibPool"
              required
              min={1}
              step={1}
              defaultValue={initial.bibPool}
              data-event-bibpool
            />
          </AdminField>
          <p className={cn(ADMIN_NOTE, "mt-1.5 max-w-[52ch]")}>
            How many physical bibs the timing system supplies at the venue. Bibs are leases drawn
            from 1 to this number, so shrinking it below a bib a runner is holding right now is
            refused and names the bib.
          </p>
        </div>

        <div>
          <AdminField label="Heat interval (min)" className="max-w-[130px]">
            <input
              className={adminInput()}
              type="number"
              name="heatIntervalMinutes"
              required
              min={1}
              step={1}
              defaultValue={initial.heatIntervalMinutes}
              data-event-interval
            />
          </AdminField>
          <p className={cn(ADMIN_NOTE, "mt-1.5 max-w-[52ch]")}>
            Spacing the heat builder prefills between generated heats. Changing it does not re-time
            heats that already exist.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <button type="submit" className={adminButton("primary")} data-event-submit>
          {submitLabel}
        </button>
        {editing ? null : (
          <p className={ADMIN_NOTE}>
            Created events land as drafts — admin-only until you announce them from the Settings
            tab.
          </p>
        )}
      </div>
    </form>
  );
}
