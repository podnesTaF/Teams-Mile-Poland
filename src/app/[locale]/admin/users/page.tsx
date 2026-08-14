import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { requireAdmin } from "@/features/admin/action-helpers";
import { AdminPage } from "@/features/admin/components/shell/admin-page";
import { NoDatabaseNotice } from "@/features/admin/components/no-database-notice";
import { formatAdminDate } from "@/features/admin/format";
import { resendUserVerification } from "@/features/admin/users-actions";
import {
  getUserStats,
  listUsers,
  type ParticipationFilter,
  type RegisteredFilter,
  type UserListFilters,
  type UserListRow,
  type VerifiedFilter,
} from "@/features/admin/users-data";
import { userCan } from "@/lib/auth/user-session";
import { Link } from "@/i18n/navigation";

type SearchParams = {
  q?: string;
  verified?: string;
  participation?: string;
  registered?: string;
  msg?: string;
};

function parseVerified(v: string | undefined): VerifiedFilter | undefined {
  return v === "verified" || v === "unverified" ? v : undefined;
}
function parseParticipation(v: string | undefined): ParticipationFilter | undefined {
  return v === "attended" || v === "no_show" ? v : undefined;
}
function parseRegistered(v: string | undefined): RegisteredFilter | undefined {
  return v === "registered" || v === "not_registered" ? v : undefined;
}

export default async function AdminUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const actor = await requireAdmin(locale);

  const filters: UserListFilters = {
    q: sp.q?.trim() || undefined,
    verified: parseVerified(sp.verified),
    participation: parseParticipation(sp.participation),
    registered: parseRegistered(sp.registered),
  };

  return (
    <AdminPage title="Users">
      {sp.msg ? <div className="iv-notice iv-notice--info">{sp.msg}</div> : null}

      {process.env.DATABASE_URL ? (
        <UsersBody locale={locale} filters={filters} sp={sp} canEdit={userCan(actor, "edit")} />
      ) : (
        <NoDatabaseNotice>manage users</NoDatabaseNotice>
      )}
    </AdminPage>
  );
}

async function UsersBody({
  locale,
  filters,
  sp,
  canEdit,
}: {
  locale: string;
  filters: UserListFilters;
  sp: SearchParams;
  canEdit: boolean;
}) {
  const [rows, stats] = await Promise.all([listUsers(filters), getUserStats()]);
  const isFiltered = Boolean(
    filters.q || filters.verified || filters.participation || filters.registered,
  );

  return (
    <>
      {/* Headline totals — the whole system, deliberately unaffected by the
          filters below so the line always answers "how many do we have". */}
      <p className="iv-note" style={{ marginTop: 20 }}>
        <strong>{stats.total}</strong> {stats.total === 1 ? "person" : "people"} in the system ·{" "}
        <strong>{stats.verified}</strong> verified
        {rows.length !== stats.total ? <> · {rows.length} matching the filters</> : null}
      </p>

      <form method="get" className="iv-card" style={{ marginTop: 12 }}>
        <div className="iv-inline" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ flex: "1 1 220px" }}>
            <span className="iv-fieldlabel">Search name or email</span>
            <input
              className="iv-input"
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="e.g. Kowalski or ola@…"
            />
          </label>
          <label>
            <span className="iv-fieldlabel">Verified</span>
            <select className="iv-input" name="verified" defaultValue={sp.verified ?? ""}>
              <option value="">Any</option>
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
            </select>
          </label>
          <label>
            <span className="iv-fieldlabel">First event</span>
            <select className="iv-input" name="participation" defaultValue={sp.participation ?? ""}>
              <option value="">Any</option>
              <option value="attended">Attended</option>
              <option value="no_show">No-show</option>
            </select>
          </label>
          <label>
            <span className="iv-fieldlabel">Aug registration</span>
            <select className="iv-input" name="registered" defaultValue={sp.registered ?? ""}>
              <option value="">Any</option>
              <option value="registered">Registered</option>
              <option value="not_registered">Not registered</option>
            </select>
          </label>
          <div className="iv-inline">
            <button type="submit" className="btn btn-red btn-sm">
              Apply
            </button>
            {isFiltered ? (
              <Link href="/admin/users" className="btn btn-stroke btn-sm">
                Clear
              </Link>
            ) : null}
          </div>
        </div>
      </form>

      <section className="iv-card" style={{ marginTop: 18 }}>
        {rows.length === 0 ? (
          <p className="iv-note">
            {isFiltered ? "No users match these filters." : "No users yet."}
          </p>
        ) : (
          <div className="iv-tablewrap">
            <table className="iv-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Signed up</th>
                  <th>Verified</th>
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
    </>
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
      <td>{formatAdminDate(user.createdAt)}</td>
      <td>
        <span className={`iv-pill ${user.emailVerified ? "iv-pill--ok" : "iv-pill--due"}`}>
          {user.emailVerified ? "verified" : "unverified"}
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
