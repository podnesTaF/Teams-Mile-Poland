/**
 * Event domain model for the landing site.
 *
 * The site hosts a series of events over time. Each event moves through a
 * lifecycle, and the landing renders itself from that state: the "featured"
 * (next) event drives the register CTA, while completed events expose results.
 *
 * Phase 1 keeps this layer config-driven (see `registry.ts`) — no DB. When a
 * real second event opens registration, registration data (teams / runners /
 * slot_counter) gains an `event_id` FK; this model is the seam for that.
 */

export type EventStatus =
  | "upcoming" // announced, registration not yet open
  | "registration_open" // accepting registrations now
  | "registration_closed" // full or closed, event not yet run
  | "completed"; // has happened; results may be available

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
  results?: EventResults;
};
