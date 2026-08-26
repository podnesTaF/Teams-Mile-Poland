/**
 * The roster table's list state — search, status filter, sort and page — as it
 * travels in the URL.
 *
 * All four live in the query string rather than in client state, which is what
 * makes a roster view linkable, back-button-correct and survivable across the
 * form-post → redirect round-trip every admin mutation performs. This module is
 * the one place that reads them out of `searchParams` and writes them back into
 * hrefs, so the table header, the filter chips, the search box and the pager
 * cannot disagree about what a URL means.
 *
 * Every parse is total: anything unrecognised — a hand-edited `?sort=`, a stale
 * bookmark's `?page=0`, a repeated param — resolves to the default rather than
 * to an error, because a roster is an operational page and must always render.
 *
 * Pure: no database, no React. Kept out of `events-data.ts` so a client
 * component could import the href helpers without pulling Drizzle behind them.
 */

import {
  DEFAULT_ROSTER_SORT,
  type ParticipationStatus,
  type RosterSort,
  type RosterSortKey,
} from "./events-data";

/** The four live statuses, in lifecycle order — the filter chips' order too. */
export const ROSTER_STATUSES: ParticipationStatus[] = [
  "registered",
  "confirmed",
  "checked_in",
  "no_show",
];

/** Columns the table can be ordered by; anything else falls back to the default. */
export const ROSTER_SORT_KEYS: RosterSortKey[] = ["bib", "name", "status", "registered-at", "best"];

/**
 * Rows per page. Sized so a full page fits a laptop screen without scrolling the
 * page chrome away, and so an event of a few hundred entries is a handful of
 * pages rather than a scroll.
 */
export const ROSTER_PAGE_SIZE = 25;

/** A search longer than this is not a name; it is someone's pasted URL. */
const MAX_QUERY_LENGTH = 100;

/** The roster page's own `searchParams`, whatever else they also carry. */
export type RosterSearchParams = Record<string, string | string[] | undefined>;

export type RosterParams = {
  status?: ParticipationStatus;
  /** Trimmed free text; `""` when there is no search. */
  q: string;
  sort: RosterSort;
  /** 1-based, and at least 1 — clamped against the real page count by the page. */
  page: number;
};

function param(query: RosterSearchParams, key: string): string {
  const raw = query[key];
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
}

/**
 * A sort as it appears in the URL: the column key, with a leading `-` for
 * descending (`?sort=name`, `?sort=-registered-at`).
 */
export function sortToken(sort: RosterSort): string {
  return sort.dir === "desc" ? `-${sort.key}` : sort.key;
}

function parseSort(value: string): RosterSort {
  const dir = value.startsWith("-") ? "desc" : "asc";
  const key = value.startsWith("-") ? value.slice(1) : value;
  return ROSTER_SORT_KEYS.includes(key as RosterSortKey)
    ? { key: key as RosterSortKey, dir }
    : DEFAULT_ROSTER_SORT;
}

/** Read the whole list state out of a roster page's query string. */
export function parseRosterParams(query: RosterSearchParams): RosterParams {
  const status = param(query, "status");
  const page = Number.parseInt(param(query, "page"), 10);
  return {
    status: ROSTER_STATUSES.includes(status as ParticipationStatus)
      ? (status as ParticipationStatus)
      : undefined,
    q: param(query, "q").slice(0, MAX_QUERY_LENGTH),
    sort: parseSort(param(query, "sort")),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** Whether the admin has narrowed the roster at all — the two empty states differ. */
export function isFiltered(params: RosterParams): boolean {
  return Boolean(params.status) || params.q !== "";
}

/**
 * The roster URL for a variation on the current state.
 *
 * Defaults are left out of the query string, so the unfiltered first page is the
 * bare `/admin/events/<slug>` an admin arrives on from the sidebar rather than a
 * URL restating everything it is not.
 *
 * `page` is deliberately *not* carried over unless the patch names it: changing
 * the search, the filter or the sort re-shuffles what is on which page, so
 * staying on page 7 of a different list is never what was meant.
 */
export function rosterHref(
  slug: string,
  params: RosterParams,
  patch: Partial<RosterParams> = {},
): string {
  const next = { ...params, page: 1, ...patch };
  const search = new URLSearchParams();
  if (next.status) search.set("status", next.status);
  if (next.q) search.set("q", next.q);
  if (sortToken(next.sort) !== sortToken(DEFAULT_ROSTER_SORT)) {
    search.set("sort", sortToken(next.sort));
  }
  if (next.page > 1) search.set("page", String(next.page));
  const query = search.toString();
  return `/admin/events/${slug}${query ? `?${query}` : ""}`;
}

/**
 * What clicking a column header should do: order by it ascending, unless it is
 * already the sorted column, in which case flip the direction.
 */
export function toggleSort(current: RosterSort, key: RosterSortKey): RosterSort {
  return current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" };
}
