import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { requireAdmin } from "@/features/admin/action-helpers";
import { AdminPage } from "@/features/admin/components/shell/admin-page";
import { NoDatabaseNotice } from "@/features/admin/components/no-database-notice";
import { formatAdminDate } from "@/features/admin/format";
import { resendUserVerification } from "@/features/admin/users-actions";
import {
  countUsers,
  DEFAULT_USER_SORT,
  getUserStats,
  listUsers,
  type CompleteFilter,
  type ParticipationFilter,
  type RegisteredFilter,
  type UserListFilters,
  type UserListRow,
  type UserSort,
  type UserSortKey,
  type VerifiedFilter,
} from "@/features/admin/users-data";
import { userCan } from "@/lib/auth/user-session";
import { Link } from "@/i18n/navigation";

/**
 * Rows per page. Larger than the roster's 25 because this table is scanned for a
 * person rather than read down a check-in queue, and a few thousand accounts
 * should be tens of pages, not hundreds.
 */
const USERS_PAGE_SIZE = 50;

/** A search longer than this is not a name, an email or a phone number. */
const MAX_QUERY_LENGTH = 100;

/** Columns the table can be ordered by; anything else falls back to the default. */
const USER_SORT_KEYS: UserSortKey[] = ["name", "signed-up"];

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The users list's whole view state, as it travels in the URL.
 *
 * Filters, sort and page all live in the query string rather than in client
 * state — the same choice the roster made in issue #40, and for the same
 * reasons: the view is linkable, back-button-correct, and survives the
 * form-post → redirect round-trip that `resendUserVerification` performs.
 */
type UserListState = {
  filters: UserListFilters;
  sort: UserSort;
  /** 1-based, and at least 1 — clamped against the real page count below. */
  page: number;
};

function param(query: SearchParams, key: string): string {
  const raw = query[key];
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
}

function parseVerified(v: string): VerifiedFilter | undefined {
  return v === "verified" || v === "unverified" ? v : undefined;
}
function parseParticipation(v: string): ParticipationFilter | undefined {
  return v === "attended" || v === "no_show" ? v : undefined;
}
function parseRegistered(v: string): RegisteredFilter | undefined {
  return v === "registered" || v === "not_registered" ? v : undefined;
}
function parseComplete(v: string): CompleteFilter | undefined {
  return v === "complete" || v === "incomplete" ? v : undefined;
}

/**
 * A sort as it appears in the URL: the column key, with a leading `-` for
 * descending (`?sort=name`, `?sort=-signed-up`) — the roster's token, so the two
 * admin tables read the same in a bookmark.
 */
function sortToken(sort: UserSort): string {
  return sort.dir === "desc" ? `-${sort.key}` : sort.key;
}

function parseSort(value: string): UserSort {
  const dir = value.startsWith("-") ? "desc" : "asc";
  const key = value.startsWith("-") ? value.slice(1) : value;
  return USER_SORT_KEYS.includes(key as UserSortKey)
    ? { key: key as UserSortKey, dir }
    : DEFAULT_USER_SORT;
}

/** Read the whole view state out of the query string; every parse is total. */
function parseUserListState(query: SearchParams): UserListState {
  const page = Number.parseInt(param(query, "page"), 10);
  return {
    filters: {
      q: param(query, "q").slice(0, MAX_QUERY_LENGTH) || undefined,
      verified: parseVerified(param(query, "verified")),
      participation: parseParticipation(param(query, "participation")),
      registered: parseRegistered(param(query, "registered")),
      complete: parseComplete(param(query, "complete")),
    },
    sort: parseSort(param(query, "sort")),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

function isFiltered(filters: UserListFilters): boolean {
  return Boolean(
    filters.q || filters.verified || filters.participation || filters.registered || filters.complete,
  );
}

/**
 * The users URL for a variation on the current state — the one place a link,
 * a column header and the pager agree about what a URL means.
 *
 * Defaults are left out, so the unfiltered first page is the bare `/admin/users`
 * the sidebar points at. `page` is deliberately not carried over unless the
 * patch names it: changing a filter or the sort re-shuffles what is on which
 * page, so staying on page 7 of a different list is never what was meant.
 */
function usersHref(state: UserListState, patch: Partial<UserListState> = {}): string {
  const next: UserListState = { ...state, page: 1, ...patch };
  const filters = { ...next.filters };
  const search = new URLSearchParams();
  if (filters.q) search.set("q", filters.q);
  if (filters.verified) search.set("verified", filters.verified);
  if (filters.participation) search.set("participation", filters.participation);
  if (filters.registered) search.set("registered", filters.registered);
  if (filters.complete) search.set("complete", filters.complete);
  if (sortToken(next.sort) !== sortToken(DEFAULT_USER_SORT)) {
    search.set("sort", sortToken(next.sort));
  }
  if (next.page > 1) search.set("page", String(next.page));
  const query = search.toString();
  return `/admin/users${query ? `?${query}` : ""}`;
}

/**
 * What clicking a column header should do: order by it ascending, unless it is
 * already the sorted column, in which case flip the direction.
 */
function toggleSort(current: UserSort, key: UserSortKey): UserSort {
  return current.key === key
    ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
    : { key, dir: "asc" };
}

export default async function AdminUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const actor = await requireAdmin(locale);

  const state = parseUserListState(query);
  const msg = param(query, "msg");

  return (
    <AdminPage title="Users">
      {msg ? <div className="iv-notice iv-notice--info">{msg}</div> : null}

      {process.env.DATABASE_URL ? (
        <UsersBody locale={locale} state={state} canEdit={userCan(actor, "edit")} />
      ) : (
        <NoDatabaseNotice>manage users</NoDatabaseNotice>
      )}
    </AdminPage>
  );
}

async function UsersBody({
  locale,
  state,
  canEdit,
}: {
  locale: string;
  state: UserListState;
  canEdit: boolean;
}) {
  const { filters } = state;
  const [matches, stats] = await Promise.all([countUsers(filters), getUserStats()]);

  // An out-of-range page lands on the last real one rather than on a void: a
  // `?page=` outlives the rows it was written for as soon as the search is
  // narrowed, and an admin following that link wants people.
  const pageCount = Math.max(1, Math.ceil(matches / USERS_PAGE_SIZE));
  const list: UserListState = { ...state, page: Math.min(state.page, pageCount) };
  const offset = (list.page - 1) * USERS_PAGE_SIZE;

  const rows =
    matches === 0
      ? []
      : await listUsers(filters, { sort: list.sort, limit: USERS_PAGE_SIZE, offset });

  const filtered = isFiltered(filters);

  return (
    <>
      {/* Headline totals — the whole system, deliberately unaffected by the
          filters below so the line always answers "how many do we have".
          Verified and profile-complete are two different facts and overlap
          freely, which is why they are stated side by side rather than nested. */}
      <p className="iv-note" style={{ marginTop: 20 }}>
        <strong>{stats.total}</strong> {stats.total === 1 ? "person" : "people"} in the system ·{" "}
        <strong>{stats.verified}</strong> verified · <strong>{stats.profileComplete}</strong>{" "}
        with a complete profile
        {filtered ? <> · {matches} matching the filters</> : null}
      </p>

      {/* A GET form submits only its own fields, so the sort — which is not a
          field here — travels as a hidden input. `page` deliberately does not:
          a new filter re-shuffles what is on which page. */}
      <form method="get" className="iv-card" style={{ marginTop: 12 }}>
        {sortToken(list.sort) === sortToken(DEFAULT_USER_SORT) ? null : (
          <input type="hidden" name="sort" value={sortToken(list.sort)} />
        )}
        <div className="iv-inline" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ flex: "1 1 220px" }}>
            <span className="iv-fieldlabel">Search name, email or phone</span>
            <input
              className="iv-input"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="e.g. Kowalski, ola@… or 600123"
            />
          </label>
          <label>
            <span className="iv-fieldlabel">Verified</span>
            <select className="iv-input" name="verified" defaultValue={filters.verified ?? ""}>
              <option value="">Any</option>
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
            </select>
          </label>
          <label>
            <span className="iv-fieldlabel">Profile</span>
            <select className="iv-input" name="complete" defaultValue={filters.complete ?? ""}>
              <option value="">Any</option>
              <option value="complete">Complete</option>
              <option value="incomplete">Incomplete</option>
            </select>
          </label>
          <label>
            <span className="iv-fieldlabel">First event</span>
            <select
              className="iv-input"
              name="participation"
              defaultValue={filters.participation ?? ""}
            >
              <option value="">Any</option>
              <option value="attended">Attended</option>
              <option value="no_show">No-show</option>
            </select>
          </label>
          <label>
            <span className="iv-fieldlabel">Aug registration</span>
            <select className="iv-input" name="registered" defaultValue={filters.registered ?? ""}>
              <option value="">Any</option>
              <option value="registered">Registered</option>
              <option value="not_registered">Not registered</option>
            </select>
          </label>
          <div className="iv-inline">
            <button type="submit" className="btn btn-red btn-sm">
              Apply
            </button>
            {filtered ? (
              <Link href="/admin/users" className="btn btn-stroke btn-sm">
                Clear
              </Link>
            ) : null}
          </div>
        </div>
      </form>

      <section className="iv-card" style={{ marginTop: 18 }}>
        {rows.length === 0 ? (
          <p className="iv-note">{filtered ? "No users match these filters." : "No users yet."}</p>
        ) : (
          <div className="iv-tablewrap">
            <table className="iv-table">
              <thead>
                <tr>
                  <SortHeader state={list} sortKey="name" label="Name" />
                  <th>Email</th>
                  <th>Phone</th>
                  <SortHeader state={list} sortKey="signed-up" label="Signed up" />
                  <th>Verified</th>
                  <th>Profile</th>
                  <th>First event</th>
                  <th>Aug regs</th>
                  <th>Races run</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <UserRowView key={u.id} user={u} locale={locale} canEdit={canEdit} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {rows.length > 0 ? (
        <UsersPager
          state={list}
          pageCount={pageCount}
          matches={matches}
          offset={offset}
          shown={rows.length}
        />
      ) : null}
    </>
  );
}

/**
 * A column header that is also the control for ordering by it: click to sort
 * ascending, click the sorted column again to flip. The direction is stated
 * twice — as an arrow for the eye and as `aria-sort` for a screen reader — and
 * the link is just a URL, so sorting survives a reload like every other bit of
 * this page's state.
 */
function SortHeader({
  state,
  sortKey,
  label,
}: {
  state: UserListState;
  sortKey: UserSortKey;
  label: string;
}) {
  const active = state.sort.key === sortKey;
  return (
    <th aria-sort={active ? (state.sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link
        href={usersHref(state, { sort: toggleSort(state.sort, sortKey) })}
        className="iv-linkbtn"
        data-users-sort={sortKey}
        data-active={active ? "true" : "false"}
      >
        {label}
        {active ? <span aria-hidden> {state.sort.dir === "asc" ? "↑" : "↓"}</span> : null}
      </Link>
    </th>
  );
}

function UsersPager({
  state,
  pageCount,
  matches,
  offset,
  shown,
}: {
  state: UserListState;
  pageCount: number;
  matches: number;
  offset: number;
  shown: number;
}) {
  return (
    <div
      className="iv-inline"
      style={{ marginTop: 12, gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}
    >
      <p className="iv-note" data-users-count={matches}>
        Showing {offset + 1}–{offset + shown} of {matches}
      </p>

      {pageCount > 1 ? (
        <nav aria-label="User pages" className="iv-inline" style={{ gap: 8 }}>
          <PagerLink
            href={usersHref(state, { page: state.page - 1 })}
            disabled={state.page <= 1}
            rel="prev"
          >
            ← Previous
          </PagerLink>
          <span className="iv-note" data-users-page={state.page} data-users-pages={pageCount}>
            Page {state.page} of {pageCount}
          </span>
          <PagerLink
            href={usersHref(state, { page: state.page + 1 })}
            disabled={state.page >= pageCount}
            rel="next"
          >
            Next →
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
      <span aria-disabled className="btn btn-stroke btn-sm" style={{ opacity: 0.4 }}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} rel={rel} data-users-nav={rel} className="btn btn-stroke btn-sm">
      {children}
    </Link>
  );
}

function FirstEventBadge({ attended }: { attended: boolean | null }) {
  if (attended === null) return <span className="iv-cellsub">—</span>;
  return (
    <span className={`iv-pill ${attended ? "iv-pill--ok" : "iv-pill--red"}`}>
      {attended ? "attended" : "no-show"}
    </span>
  );
}

function UserRowView({
  user,
  locale,
  canEdit,
}: {
  user: UserListRow;
  locale: string;
  canEdit: boolean;
}) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.name;
  return (
    <tr>
      <td>
        <Link href={`/admin/users/${user.id}`} className="iv-linkbtn">
          {name}
        </Link>
      </td>
      <td>{user.email}</td>
      <td>{user.phone || <span className="iv-cellsub">—</span>}</td>
      <td>{formatAdminDate(user.createdAt)}</td>
      <td>
        <span className={`iv-pill ${user.emailVerified ? "iv-pill--ok" : "iv-pill--due"}`}>
          {user.emailVerified ? "verified" : "unverified"}
        </span>
      </td>
      <td>
        {/* The same gate the runner meets at registration: without these five
            fields they cannot enter an event, whatever their email says. */}
        <span className={`iv-pill ${user.profileComplete ? "iv-pill--ok" : "iv-pill--due"}`}>
          {user.profileComplete ? "complete" : "incomplete"}
        </span>
      </td>
      <td>
        <FirstEventBadge attended={user.firstEventAttended} />
      </td>
      <td>{user.augRegistrationCount}</td>
      <td>{user.raceCount}</td>
      <td>
        <div className="iv-inline">
          <Link href={`/admin/users/${user.id}`} className="iv-linkbtn">
            View
          </Link>
          {canEdit && !user.emailVerified ? (
            <form action={resendUserVerification}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={user.id} />
              <input type="hidden" name="redirectTo" value="" />
              <button type="submit" className="iv-linkbtn">
                Resend verification
              </button>
            </form>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
