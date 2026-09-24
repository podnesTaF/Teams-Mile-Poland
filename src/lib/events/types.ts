/**
 * Event domain model for the landing site.
 *
 * The site hosts a series of events over time. Each event moves through a
 * lifecycle, and the landing renders itself from that state: the "featured"
 * (next) event drives the register CTA, while completed events expose results.
 *
 * These types describe rows, not config. Events live in the `events` table
 * (`src/db/schema/events.ts`) and are read through `src/lib/events/store.ts`,
 * which `registry.ts` re-exports so its long-standing consumers keep importing
 * `@/lib/events/registry`. `registry.ts` itself is down to the window and
 * venue defaults the admin create form prefills — the lifecycle is an admin
 * action now, not a code edit plus a deploy.
 */

export type EventStatus =
  | "draft" // created but not announced; admin-only, 404s on every public surface
  | "upcoming" // announced, registration not yet open
  | "registration_open" // accepting registrations now
  | "registration_closed" // full or closed, event not yet run
  | "completed" // has happened; results may be available
  | "cancelled"; // called off; public page says so, history kept

/**
 * `team` — a team-format night. Historically only the frozen legacy TEAMS MILE
 * event (teams/runners/slot_counter stack, see {@link LEGACY_TEAM_EVENT_SLUG});
 * from PRD #64 on, a `team` event is entered by team managers through the
 * `user_team_*` and `event_*` tables, exactly like an `individual` one.
 * `individual` — the Aug-2026 mile series: per-person entry, capped free +
 * paid slots, user accounts. Drives which registration flow a page links to.
 * `mixed` — a night that hosts both (from 2026-09-22, ADR 0009): a runner
 * registers alone through the individual flow **or** is entered by their team
 * manager, never both — the unique `(event_slug, user_id)` registration index
 * is what keeps one person to one entry path per night.
 *
 * Do not compare `eventType` against a literal on a shared surface; ask
 * {@link acceptsIndividuals} / {@link acceptsTeams} instead, so a `mixed`
 * night is admitted wherever either path is.
 */
export type EventType = "team" | "individual" | "mixed";

/** Whether a night of this type takes per-person registrations. */
export function typeAcceptsIndividuals(eventType: EventType | undefined): boolean {
  return eventType === "individual" || eventType === "mixed";
}

/** Whether a night of this type takes team entries (`team_entries`, PRD #64). */
export function typeAcceptsTeams(eventType: EventType | undefined): boolean {
  return eventType === "team" || eventType === "mixed";
}

/**
 * The event has an individual registration path: `individual` or `mixed`.
 * Replaces every `eventType === "individual"` gate on the per-person flow, the
 * individual results/gallery surfaces and the reminder mailings.
 */
export function acceptsIndividuals<T extends Pick<EventSummary, "slug" | "eventType">>(
  event: T | null | undefined,
): event is T {
  return Boolean(event) && typeAcceptsIndividuals(event?.eventType);
}

/**
 * The event has a team entry path on the current stack: a `team` or `mixed`
 * night that is not the frozen legacy event. Replaces every
 * `eventType === "team"` gate on the team entry, confirmation and desk flows.
 */
export function acceptsTeams<T extends Pick<EventSummary, "slug" | "eventType">>(
  event: T | null | undefined,
): event is T {
  return Boolean(event) && !isLegacyEvent(event) && typeAcceptsTeams(event?.eventType);
}

/**
 * The one frozen legacy TEAMS MILE event (ADR 0008). The only `team`-type row
 * the current stack must keep treating as legacy.
 */
export const LEGACY_TEAM_EVENT_SLUG = "warsaw-2026";

/** True for the frozen legacy event (and for a summary with no type at all). */
export function isLegacyEvent(
  event: Pick<EventSummary, "slug" | "eventType"> | null | undefined,
): boolean {
  if (!event) return false;
  return event.slug === LEGACY_TEAM_EVENT_SLUG || event.eventType === undefined;
}

/**
 * An event on the current stack — `individual`, or a `team` event entered by
 * managers (PRD #64). Use this instead of `eventType !== "individual"` on every
 * surface that serves both types (admin event pages, check-in, heats, tickets,
 * consent, the public event page and start list). Surfaces that are genuinely
 * individual-only (the per-person register flow) keep their `eventType` check.
 */
export function isSeriesEvent(event: EventSummary | null | undefined): event is EventSummary {
  return Boolean(event) && !isLegacyEvent(event);
}

/** Local wall-clock time window for an event, e.g. { start: "09:15", end: "12:15" }. */
export type TimeRange = { start: string; end: string };

/**
 * One row of an event's on-site schedule. `time` is a display string
 * (single time or range); `labelKey` resolves under the `events.timetable`
 * i18n namespace so the same template renders in every locale.
 */
export type TimetableBlock = {
  time: string;
  labelKey: string;
};

export type Gender = "M" | "F";

export type ResultEntry = {
  /** `event_results.id` for an imported row; absent on a config-sheet entry. */
  id?: string;
  /** Finishing place within the heat, as officially recorded. */
  place: number;
  /**
   * Bib number (kept for data integrity; not shown in the current table). Null
   * only on a team row the timing file recorded without one (ADR 0014).
   */
  bib: number | null;
  gender: Gender;
  name: string;
  /** Net time in hundredths of a second — the sortable source of truth. */
  timeCs: number;
  /** Cumulative timing-point readings, when the import carried them. */
  splits?: ResultSplitPoint[] | null;
  /** Set when this mile was run as a team RACER (ADR 0014). */
  team?: { name: string; place: number | null; timeCs: number | null } | null;
};

/** One timing point: metres from the start line, gun-relative hundredths. */
export type ResultSplitPoint = { m: number; cs: number };

export type ResultHeat = {
  /** Heat number, 1-based. */
  number: number;
  entries: ResultEntry[];
};

export type EventResults = {
  /** Optional stage / weekend label for multi-round formats. */
  stage?: string;
  heats: ResultHeat[];
};

/**
 * Bibs available per event night when config does not say otherwise — the
 * RaceResult timing system supplies 50 (ADR 0003).
 */
export const DEFAULT_BIB_POOL = 50;

/**
 * The series' public group page on RaceResult — the timing system's own
 * live view during a race night and its archive afterwards. One group covers
 * every event in the series, so each results surface links here.
 */
export const RACE_RESULT_GROUP_URL = "https://my.raceresult.com/groups/7553/";

/** Spacing between generated heats when config does not say otherwise. */
export const DEFAULT_HEAT_INTERVAL_MINUTES = 10;

/** Photo vs. video, split from the Drive file's MIME type at build time. */
export type EventMediaKind = "photo" | "video";

/**
 * One media file in a completed event's public Drive gallery folder, as listed
 * via the Drive API. All thumbnail / large / download / preview URLs derive
 * from `id` (see `drive-urls.ts`); nothing else about the file is persisted.
 * `name` is the filename and doubles as the sort key (photographer shooting
 * order). Which folder to list lives in the `event_media` DB table
 * (`media-config.ts`), published from the admin panel.
 */
export type EventMediaItem = {
  id: string;
  name: string;
  kind: EventMediaKind;
  /** Pixel dimensions when Drive reports them; used for grid aspect ratios. */
  width?: number;
  height?: number;
};

export type EventSummary = {
  slug: string;
  status: EventStatus;
  /** Defaults to "team" for legacy events that omit it. */
  eventType?: EventType;
  name: string;
  /** ISO date, YYYY-MM-DD — used for ordering. */
  date: string;
  /** Locale-independent display date, e.g. "27 · 06 · 2026". */
  shortDate: string;
  venue: string;
  city: string;
  /** Wall-clock window shown on the event page (individual events). */
  timeRange?: TimeRange;
  /** On-site schedule blocks (individual events). */
  timetable?: TimetableBlock[];
  /**
   * Physical bibs the timing system supplies at the venue (individual events).
   * Bibs are leases drawn from `1..bibPool` — see ADR 0003. Defaults to
   * {@link DEFAULT_BIB_POOL} when omitted.
   */
  bibPool?: number;
  /**
   * The explicit bib numbers to issue instead of `1..bibPool`, ascending, when
   * the event defines a slot list (`events.bib_slots`). Absent otherwise —
   * read the effective list through `getBibSlots`, not from here.
   */
  bibSlots?: number[];
  /**
   * Spacing used to prefill generated heat start times (individual events).
   * Defaults to {@link DEFAULT_HEAT_INTERVAL_MINUTES} when omitted.
   */
  heatIntervalMinutes?: number;
  /**
   * What one team entry costs on this night, in whole ACER, debited from the
   * team's treasury when the manager enters (ADR 0013). `0` — the default for
   * every row nobody has priced — means free.
   *
   * Present on the summary rather than read from the row at the debit, because
   * every surface that offers the button has to *show* the price first: an
   * entry that fails at submit for want of money is the failure this field
   * exists to prevent.
   */
  teamEntryFeeAcer?: number;
  /** What one individual registration costs, in whole ACER. See {@link EventSummary.teamEntryFeeAcer}. */
  individualEntryFeeAcer?: number;
  results?: EventResults;
};
