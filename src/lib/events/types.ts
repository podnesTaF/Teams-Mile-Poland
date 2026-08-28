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
 * `team` — the legacy TEAMS MILE format (teams/runners/slot_counter stack).
 * `individual` — the Aug-2026 mile series: per-person entry, capped free +
 * paid slots, user accounts. Drives which registration flow a page links to.
 */
export type EventType = "team" | "individual";

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
  /** Finishing place within the heat, as officially recorded. */
  place: number;
  /** Bib number (kept for data integrity; not shown in the current table). */
  bib: number;
  gender: Gender;
  name: string;
  /** Net time in hundredths of a second — the sortable source of truth. */
  timeCs: number;
};

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
  results?: EventResults;
};
