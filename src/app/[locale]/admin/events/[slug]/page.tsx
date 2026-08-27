import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Form from "next/form";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { requireAdmin } from "@/features/admin/action-helpers";
import { AdminFlash } from "@/features/admin/components/admin-flash";
import { RosterTable } from "@/features/admin/components/roster/roster-table";
import { adminButton } from "@/features/admin/components/shell/admin-button";
import { AdminEmptyState } from "@/features/admin/components/shell/admin-empty-state";
import { adminInput } from "@/features/admin/components/shell/admin-field";
import {
  countEventRoster,
  DEFAULT_ROSTER_SORT,
  getEventRoster,
  getRosterStats,
  type ParticipationStatus,
  type RosterRow,
  type RosterSortKey,
} from "@/features/admin/events-data";
import { plural } from "@/features/admin/format";
import { getEventHeats } from "@/features/admin/heats-data";
import { getSeasonBests, type SeasonBest } from "@/features/admin/roster-best";
import {
  isFiltered,
  parseRosterParams,
  ROSTER_PAGE_SIZE,
  ROSTER_SORT_KEYS,
  ROSTER_STATUSES,
  rosterHref,
  sortToken,
  toggleSort,
  type RosterParams,
  type RosterSearchParams,
} from "@/features/admin/roster-query";
import {
  toHeatOption,
  toRosterRowView,
  type HeatOption,
  type RosterRowView,
} from "@/features/admin/roster-view";
import { userCan } from "@/lib/auth/user-session";
import { getBibPool, getEventBySlug } from "@/lib/events/registry";
import type { EventStatus } from "@/lib/events/types";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<RosterSearchParams>;
};

/**
 * The Roster tab: who has entered this event, and the one destructive action on
 * them.
 *
 * Its entire list state — `?q=`, `?status=`, `?sort=`, `?page=` — lives in the
 * URL and is applied by the database (`roster-query.ts` reads and writes the
 * params; `events-data.ts` runs them). Nothing here is a client table: a
 * paginated view has to survive a server action's redirect, be linkable to a
 * colleague, and work on a phone at the venue, and URL state gets all three for
 * free.
 *
 * What *is* client state is the table's two interactions (slice #41), and only
 * because neither is a view: which registration's drawer is open, and which rows
 * are ticked for a bulk move into a heat. This page still reads and formats every
 * value they render, so `RosterTable` receives plain strings and the browser
 * bundle stays free of the admin data modules.
 *
 * The event itself — name, date, lifecycle status, totals, exports — belongs to
 * the layout above (slice #39), so this page states only the roster.
 */
export default async function AdminEventRosterPage({ params, searchParams }: PageProps) {
  const { locale, slug } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const actor = await requireAdmin(locale);

  const event = await getEventBySlug(slug);
  if (!event || event.eventType !== "individual") notFound();
  // The pool the flash copy needs to bound its refusal sentences; `flash.ts`
  // stays synchronous, so the page resolves it.
  const bibPool = await getBibPool(slug);

  const requested = parseRosterParams(query);
  const eventDate = new Date(event.date);
  // Club is in the search here and nowhere else: the desk's box next door shares
  // this read but promises name / email / bib only.
  const filter = { status: requested.status, q: requested.q, searchClub: true };

  const [stats, matches] = await Promise.all([
    // Request-cached: the event header above this page already asked for these.
    getRosterStats(slug),
    countEventRoster(slug, filter),
  ]);

  // An out-of-range page lands on the last real one rather than on a void: a
  // `?page=` outlives the rows it was written for as soon as a runner is removed
  // or the search is narrowed, and an admin following that link wants runners.
  const pageCount = Math.max(1, Math.ceil(matches / ROSTER_PAGE_SIZE));
  const list: RosterParams = { ...requested, page: Math.min(requested.page, pageCount) };
  const offset = (list.page - 1) * ROSTER_PAGE_SIZE;

  // The heats come back beside the rows because they are the bulk-move form's
  // target list: seeding from the roster has to be possible on the first page
  // load, not after a trip to the Heats tab to find out what exists.
  //
  // Season best is matched in memory (`roster-best.ts`), not a column, so it is
  // the one sort the database cannot window: for that key the whole filtered
  // roster is read, ranked here, and sliced here. Every other sort stays the
  // windowed DB read it was, with bests looked up only for the page on show.
  const bestSort = list.sort.key === "best";
  const [roster, heats]: [RosterRow[], HeatOption[]] =
    matches === 0
      ? [[], []]
      : await Promise.all([
          getEventRoster(slug, {
            ...filter,
            sort: list.sort,
            ...(bestSort ? {} : { limit: ROSTER_PAGE_SIZE, offset }),
          }),
          getEventHeats(slug).then((cards) => cards.map(toHeatOption)),
        ]);

  const bests = await getSeasonBests(roster, slug);
  const pageRoster = bestSort
    ? sortBySeasonBest(roster, bests, list.sort.dir).slice(offset, offset + ROSTER_PAGE_SIZE)
    : roster;
  const rows: RosterRowView[] = pageRoster.map((row) =>
    toRosterRowView(row, eventDate, bests.get(row.userId) ?? null),
  );

  // The whole roster, never the page or the filter — the chips are the control,
  // so their counts have to say what is *available*, not what is showing.
  const registrations = ROSTER_STATUSES.reduce((sum, status) => sum + stats[status], 0);

  return (
    <>
      <AdminFlash query={query} context={{ slug, bibPool }} />

      {/* No controls above an empty roster: there is nothing to search, filter
          or sort, and the empty state should be the only thing on the page. */}
      {registrations === 0 ? null : (
        <RosterToolbar slug={slug} list={list} stats={stats} registrations={registrations} />
      )}

      {registrations === 0 ? (
        <div data-roster-empty="none">
          <AdminEmptyState title="No runners have entered yet">
            {EMPTY_ROSTER_COPY[event.status]}{" "}
            <Link
              href={`/events/${slug}`}
              className="text-admin-ink underline decoration-admin-line-2 underline-offset-2 hover:decoration-admin-accent"
            >
              Open the public event page
            </Link>{" "}
            to see what a runner sees.
          </AdminEmptyState>
        </div>
      ) : matches === 0 ? (
        <div data-roster-empty="no-matches">
          <AdminEmptyState title="No runners match this view">
            {plainDescription(list)} Nothing has been removed —{" "}
            {plural(registrations, "runner is", "runners are")} still on this roster. Clear the
            search or pick a different status to see them.
          </AdminEmptyState>
        </div>
      ) : (
        <>
          <RosterTable
            rows={rows}
            slug={slug}
            locale={locale}
            statusFilter={list.status}
            sort={list.sort}
            sortHrefs={sortHrefs(slug, list)}
            heats={heats}
            canEdit={userCan(actor, "edit")}
            canCheckin={userCan(actor, "checkin")}
          />
          <RosterPager
            slug={slug}
            list={list}
            pageCount={pageCount}
            matches={matches}
            registrations={registrations}
            offset={offset}
            shown={rows.length}
          />
        </>
      )}
    </>
  );
}

/**
 * What an empty roster means, which depends on where the night is in its
 * lifecycle — read from the registry, the source of truth for event status. An
 * empty roster before registration opens is the expected state; an empty roster
 * after it closes is the whole story of the event.
 */
const EMPTY_ROSTER_COPY: Record<EventStatus, string> = {
  draft:
    "This night is still a draft: it has no public page yet, so there is no way anyone could have entered it.",
  upcoming:
    "Registration has not opened for this night yet, so there is nothing to expect here — entries start arriving the moment it does. Open it from the event's Settings tab when you are ready.",
  registration_open:
    "Registration is open and nobody has entered yet. Entries land here on their own; heats can be generated as soon as there are runners to seed.",
  registration_closed:
    "Registration has closed with nobody entered, so there is nobody to seed into heats or check in.",
  completed: "This night has run and no runner ever entered it.",
  cancelled:
    "This night was cancelled with nobody entered, so there was nobody to tell — the roster stays empty for the record.",
};

/**
 * Order the roster by season best, fastest first when ascending. Runners with
 * no matched result sink to the bottom in *both* directions — the same rule
 * `rosterOrder` applies to a missing bib — and keep the read's name order among
 * themselves (`Array.prototype.sort` is stable).
 */
function sortBySeasonBest(
  roster: RosterRow[],
  bests: Map<string, SeasonBest>,
  dir: "asc" | "desc",
): RosterRow[] {
  const sign = dir === "desc" ? -1 : 1;
  return [...roster].sort((a, b) => {
    const ta = bests.get(a.userId)?.timeCs ?? null;
    const tb = bests.get(b.userId)?.timeCs ?? null;
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return (ta - tb) * sign;
  });
}

/** What the admin currently has switched on, said back to them in the empty state. */
function plainDescription(list: RosterParams): string {
  const parts: string[] = [];
  if (list.q) parts.push(`nothing matches “${list.q}”`);
  if (list.status) parts.push(`no runner is ${list.status.replaceAll("_", " ")}`);
  return parts.length === 0 ? "" : `In this event ${parts.join(" and ")}.`;
}

/**
 * Where each sortable column header points, built here so the table island never
 * imports `roster-query` — that module reads `DEFAULT_ROSTER_SORT` out of
 * `events-data`, and a value import from there would pull Drizzle and ExcelJS
 * into the browser bundle behind it.
 */
function sortHrefs(slug: string, list: RosterParams): Record<RosterSortKey, string> {
  return Object.fromEntries(
    ROSTER_SORT_KEYS.map((key) => [key, rosterHref(slug, list, { sort: toggleSort(list.sort, key) })]),
  ) as Record<RosterSortKey, string>;
}

/* ── controls ───────────────────────────────────────────────────────── */

/**
 * Search box and status chips.
 *
 * `next/form` with an empty `action` is the documented shape for a form whose
 * only job is to update this route's search params
 * (`03-api-reference/02-components/form.md`): it stays a real GET form when
 * JavaScript is unavailable, but with it, submitting is a client-side
 * navigation that keeps the shell and shows the event layout's skeleton instead
 * of blanking the page. It also means the locale prefix needs no handling — the
 * route it navigates to is this one.
 *
 * The filter is a row of links for the same reason the search is a form: every
 * control here only ever writes the URL.
 */
function RosterToolbar({
  slug,
  list,
  stats,
  registrations,
}: {
  slug: string;
  list: RosterParams;
  stats: Record<ParticipationStatus, number>;
  registrations: number;
}) {
  const sort = sortToken(list.sort);

  return (
    <div className="mb-4 flex flex-col gap-3">
      <Form action="" className="flex flex-wrap items-center gap-2">
        {/* A GET form submits only its own fields, so the state the search must
            not silently drop travels as hidden inputs. `page` deliberately does
            not: a new search re-shuffles what is on which page, and page 7 of a
            different list is never what was meant. */}
        {list.status ? <input type="hidden" name="status" value={list.status} /> : null}
        {sort === sortToken(DEFAULT_ROSTER_SORT) ? null : (
          <input type="hidden" name="sort" value={sort} />
        )}

        <div className="relative min-w-[200px] flex-1 sm:max-w-[380px]">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-admin-muted"
          />
          {/* `pl-9` clears the icon; `adminInput` owns everything else, so this
              box and the desk's search field stay the same control. */}
          <input
            type="text"
            name="q"
            defaultValue={list.q}
            aria-label="Search the roster"
            placeholder="Search name, email, bib or club"
            className={adminInput("pl-9")}
          />
        </div>
        <button type="submit" className={adminButton("primary")}>
          Search
        </button>
        {list.q ? (
          <Link href={rosterHref(slug, list, { q: "" })} className={adminButton("stroke")}>
            Clear
          </Link>
        ) : null}
      </Form>

      <div className="admin-scroll flex gap-1.5 overflow-x-auto pb-0.5">
        <FilterChip
          href={rosterHref(slug, list, { status: undefined })}
          active={!list.status}
          count={registrations}
        >
          All
        </FilterChip>
        {ROSTER_STATUSES.map((status) => (
          <FilterChip
            key={status}
            href={rosterHref(slug, list, { status })}
            active={list.status === status}
            count={stats[status]}
          >
            {status.replaceAll("_", " ")}
          </FilterChip>
        ))}
      </div>
    </div>
  );
}

function FilterChip({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      data-roster-filter={active ? "active" : "idle"}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-pill border px-3 py-1.5 font-sans text-[12.5px] font-medium normal-case not-italic capitalize leading-none transition-colors",
        active
          ? "border-admin-accent bg-admin-accent-soft text-admin-ink"
          : "border-admin-line text-admin-muted hover:border-admin-line-2 hover:text-admin-ink",
      )}
    >
      {children}
      <span className={cn("font-mono text-[11px]", active ? "text-admin-ink-2" : "text-admin-muted")}>
        {count}
      </span>
    </Link>
  );
}

/* ── pager ──────────────────────────────────────────────────────────── */

function RosterPager({
  slug,
  list,
  pageCount,
  matches,
  registrations,
  offset,
  shown,
}: {
  slug: string;
  list: RosterParams;
  pageCount: number;
  matches: number;
  registrations: number;
  offset: number;
  shown: number;
}) {
  const from = offset + 1;
  const to = offset + shown;

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <p
        data-roster-count={matches}
        className="font-mono text-[11px] uppercase tracking-[0.14em] text-admin-muted"
      >
        Showing {from}–{to} of {matches}
        {isFiltered(list) ? ` matching · ${registrations} total` : ""}
      </p>

      {pageCount > 1 ? (
        <nav aria-label="Roster pages" className="flex items-center gap-2">
          <PagerLink
            href={rosterHref(slug, list, { page: list.page - 1 })}
            disabled={list.page <= 1}
            rel="prev"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            Previous
          </PagerLink>
          <span
            data-roster-page={list.page}
            data-roster-pages={pageCount}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-admin-muted"
          >
            Page {list.page} of {pageCount}
          </span>
          <PagerLink
            href={rosterHref(slug, list, { page: list.page + 1 })}
            disabled={list.page >= pageCount}
            rel="next"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </PagerLink>
        </nav>
      ) : null}
    </div>
  );
}

/**
 * One end of the pager. At the first or last page the control becomes a `span`
 * rather than a dimmed link, so there is nothing to click and nothing for the
 * keyboard to land on.
 */
function PagerLink({
  href,
  disabled,
  rel,
  children,
}: {
  href: string;
  disabled: boolean;
  rel: "prev" | "next";
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span aria-disabled className={adminButton("stroke", "cursor-default opacity-40")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} rel={rel} data-roster-nav={rel} className={adminButton("stroke")}>
      {children}
    </Link>
  );
}
