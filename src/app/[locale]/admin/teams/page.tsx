import { setRequestLocale } from "next-intl/server";

import { requireAdmin } from "@/features/admin/action-helpers";
import { ADMIN_NOTE, adminCard } from "@/features/admin/components/shell/admin-card";
import { AdminEmptyState } from "@/features/admin/components/shell/admin-empty-state";
import { AdminPage } from "@/features/admin/components/shell/admin-page";
import { AdminPill } from "@/features/admin/components/shell/admin-pill";
import {
  ADMIN_TEAM_CATEGORY_LABEL,
  ADMIN_TEAM_DATE,
} from "@/features/admin/components/teams/labels";
import { listAllTeamsForAdmin } from "@/features/teams/data";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Every forming team, newest first — the organiser's sight of team formation
 * (#63, PRD #57).
 *
 * Gated on `view`, so a check-in volunteer and a view-only admin can read the
 * index and each team's page; every mutation on the detail page is gated on
 * `edit` by the action behind it. Nothing here is personal data beyond a
 * manager's name, so no `personal_data` gate applies (ADR 0007): rosters show
 * names only.
 *
 * Deliberately not paged and deliberately two queries
 * ({@link listAllTeamsForAdmin}): formation runs to a few hundred teams at
 * most, and an organiser reads this list down looking for the ones that are
 * short of Complete rather than searching it.
 */
export default async function AdminTeamsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin(locale, "view");

  const teams = await listAllTeamsForAdmin();
  const recruiting = teams.filter((row) => row.team.recruiting).length;

  return (
    <AdminPage
      eyebrow="Admin"
      title="Teams"
      actions={
        teams.length > 0 ? (
          <span className={ADMIN_NOTE} data-admin-teams-summary="">
            {teams.length} teams · {recruiting} recruiting
          </span>
        ) : null
      }
    >
      {teams.length === 0 ? (
        <div data-admin-teams="empty">
          <AdminEmptyState title="No teams yet">
            Teams are founded by runners at <code>/teams/new</code> — there is no admin path that
            creates one, because a team needs a manager who is eligible for it. As soon as somebody
            founds one it appears here, with its roster, its invitations and its request queue.
          </AdminEmptyState>
        </div>
      ) : (
        <section className={adminCard("overflow-hidden")} data-admin-teams={teams.length}>
          <div className="admin-scroll overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse">
              <thead>
                <tr className="border-b border-admin-line text-left">
                  <th scope="col" className={HEAD_CELL}>
                    Team
                  </th>
                  <th scope="col" className={HEAD_CELL}>
                    Region
                  </th>
                  <th scope="col" className={HEAD_CELL}>
                    Category
                  </th>
                  <th scope="col" className={HEAD_CELL}>
                    Members
                  </th>
                  <th scope="col" className={HEAD_CELL}>
                    Recruiting
                  </th>
                  <th scope="col" className={HEAD_CELL}>
                    Captain
                  </th>
                  <th scope="col" className={HEAD_CELL}>
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {teams.map(({ team, roster, managerName }) => (
                  <tr
                    key={team.id}
                    className="border-b border-admin-line last:border-0"
                    data-admin-team-row={team.slug}
                  >
                    <td className={cn(CELL, "text-admin-ink")}>
                      <Link
                        href={`/admin/teams/${team.slug}`}
                        className="underline decoration-admin-line-2 underline-offset-2 hover:decoration-admin-accent"
                      >
                        {team.name}
                      </Link>
                    </td>
                    <td className={CELL}>{team.region}</td>
                    <td className={CELL}>{ADMIN_TEAM_CATEGORY_LABEL[team.category]}</td>
                    <td className={CELL}>
                      <span className="font-mono text-admin-ink">{roster.count}</span>
                    </td>
                    <td className={CELL}>
                      {team.recruiting ? (
                        <AdminPill tone="accent">Recruiting</AdminPill>
                      ) : (
                        <span className="text-admin-muted">—</span>
                      )}
                    </td>
                    <td className={CELL}>{managerName}</td>
                    <td className={cn(CELL, "whitespace-nowrap font-mono text-[12px]")}>
                      {ADMIN_TEAM_DATE.format(team.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AdminPage>
  );
}

const HEAD_CELL =
  "px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-admin-muted";
const CELL = "px-3 py-2.5 align-middle text-[13px] text-admin-ink-2";
