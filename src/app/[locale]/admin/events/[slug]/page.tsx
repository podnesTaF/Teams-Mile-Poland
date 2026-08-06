import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Search } from "lucide-react";
import Form from "next/form";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { requireAdmin } from "@/features/admin/action-helpers";
import { AdminFlash } from "@/features/admin/components/admin-flash";
import { ConfirmSubmit } from "@/features/admin/components/confirm-submit";
import { adminButton } from "@/features/admin/components/shell/admin-button";
import { AdminEmptyState } from "@/features/admin/components/shell/admin-empty-state";
import { adminInput } from "@/features/admin/components/shell/admin-field";
import { ParticipationBadge } from "@/features/admin/components/shell/participation-badge";
import {
  ageCategoryForDob,
  countEventRoster,
  DEFAULT_ROSTER_SORT,
  getEventRoster,
  getRosterStats,
  holdsBib,
  type ParticipationStatus,
  type RosterRow,
  type RosterSortKey,
} from "@/features/admin/events-data";
import { formatAdminDateTime as fmt, plural } from "@/features/admin/format";
import { removeRegistration } from "@/features/admin/roster-actions";
import {
  isFiltered,
  parseRosterParams,
  ROSTER_PAGE_SIZE,
  ROSTER_STATUSES,
  rosterHref,
  sortToken,
  toggleSort,
  type RosterParams,
  type RosterSearchParams,
} from "@/features/admin/roster-query";
import { getEventBySlug } from "@/lib/events/registry";
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
 * The event itself — name, date, lifecycle status, totals, exports — belongs to
 * the layout above (slice #39), so this page states only the roster.
 */
export default async function AdminEventRosterPage({ params, searchParams }: PageProps) {
  const { locale, slug } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  await requireAdmin(locale);

  const event = getEventBySlug(slug);
  if (!event || event.eventType !== "individual") notFound();

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

  const roster =
    matches === 0
      ? []
      : await getEventRoster(slug, {
          ...filter,
          sort: list.sort,
          limit: ROSTER_PAGE_SIZE,
          offset,
        });

  // The whole roster, never the page or the filter — the chips are the control,
  // so their counts have to say what is *available*, not what is showing.
  const registrations = ROSTER_STATUSES.reduce((sum, status) => sum + stats[status], 0);

  return (
    <>
      <AdminFlash query={query} context={{ slug }} />

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
            rows={roster}
            slug={slug}
            locale={locale}
            list={list}
            eventDate={eventDate}
          />
          <RosterPager
            slug={slug}
            list={list}
            pageCount={pageCount}
            matches={matches}
            registrations={registrations}
            offset={offset}
            shown={roster.length}
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
  upcoming:
    "Registration has not opened for this night yet, so there is nothing to expect here — entries start arriving the moment it does. Lifecycle status is configuration, not data: it is flipped in the event registry.",
  registration_open:
    "Registration is open and nobody has entered yet. Entries land here on their own; heats can be generated as soon as there are runners to seed.",
  registration_closed:
    "Registration has closed with nobody entered, so there is nobody to seed into heats or check in.",
  completed: "This night has run and no runner ever entered it.",
};

/** What the admin currently has switched on, said back to them in the empty state. */
function plainDescription(list: RosterParams): string {
  const parts: string[] = [];
  if (list.q) parts.push(`nothing matches “${list.q}”`);
  if (list.status) parts.push(`no runner is ${list.status.replaceAll("_", " ")}`);
  return parts.length === 0 ? "" : `In this event ${parts.join(" and ")}.`;
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

/* ── table ──────────────────────────────────────────────────────────── */

function RosterTable({
  rows,
  slug,
  locale,
  list,
  eventDate,
}: {
  rows: RosterRow[];
  slug: string;
  locale: string;
  list: RosterParams;
  eventDate: Date;
}) {
  return (
    <section className="overflow-hidden rounded-admin-lg border border-admin-line bg-admin-surface">
      <div className="admin-scroll overflow-x-auto">
        <table data-roster-table className="w-full min-w-[900px] border-collapse text-left">
          <thead className="border-b border-admin-line bg-admin-surface-2">
            <tr>
              <SortHeader slug={slug} list={list} sortKey="bib" label="Bib" className="w-[72px]" />
              <SortHeader slug={slug} list={list} sortKey="name" label="Runner" />
              <PlainHeader label="Club" />
              <PlainHeader label="Cat." className="w-[92px]" />
              <SortHeader slug={slug} list={list} sortKey="status" label="Status" className="w-[130px]" />
              <SortHeader
                slug={slug}
                list={list}
                sortKey="registered-at"
                label="Registered"
                className="w-[150px]"
              />
              <PlainHeader label="Checked in" className="w-[150px]" />
              <th scope="col" className="w-[90px] px-3 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-line">
            {rows.map((row) => (
              <RosterTableRow
                key={row.id}
                row={row}
                eventDate={eventDate}
                slug={slug}
                locale={locale}
                list={list}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const HEAD_CELL =
  "px-3 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-admin-muted";

function PlainHeader({ label, className }: { label: string; className?: string }) {
  return (
    <th scope="col" className={cn(HEAD_CELL, className)}>
      {label}
    </th>
  );
}

/**
 * A column header that is also the control for ordering by it: click to sort
 * ascending, click the sorted column again to flip. The direction is stated
 * twice — as an arrow for the eye and as `aria-sort` for a screen reader — and
 * the link is just a URL, so sorting survives a hard reload like everything else
 * here.
 */
function SortHeader({
  slug,
  list,
  sortKey,
  label,
  className,
}: {
  slug: string;
  list: RosterParams;
  sortKey: RosterSortKey;
  label: string;
  className?: string;
}) {
  const active = list.sort.key === sortKey;
  const Arrow = active && list.sort.dir === "desc" ? ChevronDown : ChevronUp;

  return (
    <th
      scope="col"
      aria-sort={active ? (list.sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn(HEAD_CELL, "p-0", className)}
    >
      <Link
        href={rosterHref(slug, list, { sort: toggleSort(list.sort, sortKey) })}
        data-roster-sort={sortKey}
        data-active={active ? "true" : "false"}
        data-dir={active ? list.sort.dir : undefined}
        className={cn(
          "flex w-full items-center gap-1 px-3 py-2.5 transition-colors hover:text-admin-ink",
          active && "text-admin-ink",
        )}
      >
        {label}
        <Arrow className={cn("h-3 w-3 shrink-0", active ? "opacity-100" : "opacity-0")} aria-hidden />
      </Link>
    </th>
  );
}

const CELL = "px-3 py-2.5 align-middle text-[13px] text-admin-ink-2";

function RosterTableRow({
  row,
  eventDate,
  slug,
  locale,
  list,
}: {
  row: RosterRow;
  eventDate: Date;
  slug: string;
  locale: string;
  list: RosterParams;
}) {
  const name = [row.firstName, row.lastName].filter(Boolean).join(" ") || row.name;
  const category = ageCategoryForDob(row.dateOfBirth, eventDate);
  // A bib is a lease (ADR 0003), so this column shows two different facts: the
  // number a runner is wearing, and the number a runner wore. The second is
  // dimmed — otherwise the table reads as if half the pool is still out, and a
  // desk search for that number would find nobody.
  const wearing = holdsBib(row);

  return (
    <tr data-roster-row={row.id} className="transition-colors hover:bg-admin-surface-2">
      <td
        className={cn(CELL, "font-mono tabular-nums", wearing ? "text-admin-ink" : "text-admin-muted")}
        title={row.bib !== null && !wearing ? "Returned to the pool" : undefined}
      >
        {row.bib ?? "—"}
      </td>
      <td className={CELL}>
        {/* Contact slims to the email and the date of birth to its age category:
            the raw values move into the row drawer (#41), which is what buys the
            room for a sortable "Registered". Nothing is lost — the xlsx export
            still carries phone and DOB in full. */}
        <span className="block font-medium text-admin-ink">{name}</span>
        <span className="block truncate text-[11.5px] text-admin-muted">{row.email}</span>
      </td>
      <td className={CELL}>{row.club || "—"}</td>
      <td className={CELL}>
        {category || "—"}
        {row.sex ? <span className="text-admin-muted"> · {row.sex}</span> : null}
      </td>
      <td className={CELL}>
        <ParticipationBadge status={row.status} />
      </td>
      <td className={cn(CELL, "whitespace-nowrap text-admin-muted")}>{fmt(row.createdAt)}</td>
      <td className={cn(CELL, "whitespace-nowrap text-admin-muted")}>{fmt(row.checkedInAt)}</td>
      <td className={cn(CELL, "text-right")}>
        <form action={removeRegistration}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="registrationId" value={row.id} />
          {/* The action's redirect contract is frozen (PRD #34): it carries the
              status filter back and nothing else, so a removal returns to the
              first page of the filtered roster rather than to this exact view. */}
          {list.status ? <input type="hidden" name="status" value={list.status} /> : null}
          <ConfirmSubmit
            label="Remove"
            title="Remove this registration?"
            message={`This permanently deletes ${name}'s registration for this event. Use it for duplicates and withdrawal requests. This cannot be undone.`}
            confirmLabel="Remove"
            // The quiet button, tinted red on hover: a row action that only
            // announces itself as destructive when it is reached for.
            triggerClassName={adminButton("quiet", "hover:bg-admin-accent-soft hover:text-admin-accent")}
          />
        </form>
      </td>
    </tr>
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
