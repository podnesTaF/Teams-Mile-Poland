import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { requireAdmin } from "@/features/admin/action-helpers";
import { adminButton } from "@/features/admin/components/shell/admin-button";
import { ADMIN_NOTE, ADMIN_TITLE, adminCard } from "@/features/admin/components/shell/admin-card";
import { AdminNotice } from "@/features/admin/components/shell/admin-notice";
import { AdminPage } from "@/features/admin/components/shell/admin-page";
import { AdminPill } from "@/features/admin/components/shell/admin-pill";
import { AdminStat } from "@/features/admin/components/shell/admin-stat";
import { AdminInvitationActions } from "@/features/admin/components/teams/admin-invitation-actions";
import { AdminInviteOnBehalf } from "@/features/admin/components/teams/admin-invite-on-behalf";
import { AdminJoinRequestActions } from "@/features/admin/components/teams/admin-join-request-actions";
import { AdminTeamMemberActions } from "@/features/admin/components/teams/admin-team-member-actions";
import { AdminTeamSettings } from "@/features/admin/components/teams/admin-team-settings";
import { WalletPanel } from "@/features/admin/components/wallet-panel";
import { listWalletLedger } from "@/features/admin/wallet-data";
import {
  ADMIN_TEAM_CATEGORY_LABEL,
  ADMIN_TEAM_DATE,
  ADMIN_TEAM_DATETIME,
  adminTeamSexLabel,
} from "@/features/admin/components/teams/labels";
import { getTeamBySlug, getTeamRoster } from "@/features/teams/data";
import { summarizeRoster } from "@/features/teams/eligibility";
import { listOpenInvitations } from "@/features/teams/invitations";
import { listPendingJoinRequests } from "@/features/teams/join-requests";
import { getWalletBalances, parseWalletPage } from "@/features/wallet/data";
import { formatWalletBalance } from "@/features/wallet/format";
import { Link } from "@/i18n/navigation";
import { userCan } from "@/lib/auth/user-session";
import { cn } from "@/lib/utils";

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ msg?: string; wpage?: string | string[] }>;
};

const HEAD_CELL =
  "px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-admin-muted";
const CELL = "px-3 py-2.5 align-middle text-[13px] text-admin-ink-2";

/**
 * One team, as the organiser sees it (#63): the roster with names, roles and
 * sex, the pending invitations with their expiry, the request queue — and the
 * manager's own controls, run through the manager's own server actions.
 *
 * **Reads are `view`, writes are `edit`.** The page itself gates on `view`, so
 * `admin_checkin` and `admin_viewer` can look at any team; the mutation islands
 * are rendered only for `edit`, and every action behind them runs its own
 * `requireTeamManagerOrAdmin` and answers `forbidden` for the other two levels
 * regardless of what this page drew. Hiding a control is an offer, never the
 * gate — a crafted request meets the same refusal.
 *
 * No `personal_data` gate (ADR 0007): rosters carry a name, a role and a sex,
 * none of which is the date-of-birth / address / emergency-contact set that
 * capability exists for. Email addresses appear only where they *are* the
 * subject — a pending invitation is an address and nothing else.
 *
 * Dynamic, like the runner-facing team page: what it shows depends on who asks
 * and on rows that change by the minute.
 */
export default async function AdminTeamDetailPage({ params, searchParams }: PageProps) {
  const { locale, slug } = await params;
  const { msg, wpage } = await searchParams;
  setRequestLocale(locale);
  const actor = await requireAdmin(locale, "view");
  const canEdit = userCan(actor, "edit");

  const team = await getTeamBySlug(slug);
  if (!team) notFound();

  // Money is read straight from the ledger on every request: a treasury is a
  // `SUM` over completed rows, never a stored total (ADR 0012).
  const [roster, invitations, requests, treasuryBalances, treasuryLedger] = await Promise.all([
    getTeamRoster(team.id),
    listOpenInvitations(team.id),
    listPendingJoinRequests(team.id),
    getWalletBalances({ teamId: team.id }),
    listWalletLedger({ teamId: team.id }, { page: parseWalletPage(wpage) }),
  ]);
  const rosterSummary = summarizeRoster(team.category, roster);

  return (
    <AdminPage
      eyebrow="Teams"
      title={team.name}
      actions={
        <Link href={`/teams/${team.slug}`} className={adminButton("stroke")}>
          Public page
        </Link>
      }
    >
      <div data-admin-team={team.slug} data-admin-team-controls={canEdit ? "edit" : "readonly"}>
        {msg ? (
          <div data-admin-team-msg="">
            <AdminNotice tone="info" className="mb-4">
              {msg}
            </AdminNotice>
          </div>
        ) : null}
        <section className={adminCard("p-4 sm:p-5")}>
          <div className="flex flex-wrap items-center gap-2">
            <AdminPill tone="ink">{ADMIN_TEAM_CATEGORY_LABEL[team.category]}</AdminPill>
            {team.recruiting ? <AdminPill tone="accent">Recruiting</AdminPill> : null}
          </div>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
            <AdminStat label="Members" value={rosterSummary.count} />
            <AdminStat label="Pending invitations" value={invitations.length} />
            <AdminStat label="Pending requests" value={requests.length} />
            <AdminStat
              label="Treasury (ACER)"
              value={formatWalletBalance(treasuryBalances.ACER, "en")}
            />
            <AdminStat label="Region" value={team.region} />
          </div>

          {team.category === "mixed" ? (
            <p className={cn(ADMIN_NOTE, "mt-3")} data-admin-team-balance="">
              Mixed roster: {rosterSummary.men} men, {rosterSummary.women} women.
            </p>
          ) : null}

          <p className={cn(ADMIN_NOTE, "mt-3 max-w-[78ch]")}>
            Founded {ADMIN_TEAM_DATE.format(team.createdAt)} · code{" "}
            <code className="font-mono text-admin-ink">{team.code}</code> · slug{" "}
            <code className="font-mono">{team.slug}</code>
          </p>
          {team.description ? (
            <p className={cn(ADMIN_NOTE, "mt-2 max-w-[78ch] text-admin-ink-2")}>
              {team.description}
            </p>
          ) : null}
        </section>

        {canEdit ? null : (
          <AdminNotice tone="info" className="mt-4">
            Read-only on this role. Renaming, inviting, deciding a request and every roster change
            need full admin access — the actions refuse them, so the controls are not offered here.
          </AdminNotice>
        )}

        {/* ── Treasury (ADR 0012) — the grant form, the ledger, reversals ── */}
        <WalletPanel
          subject={{ teamId: team.id, teamSlug: team.slug }}
          locale={locale}
          balances={treasuryBalances}
          ledger={treasuryLedger}
          canEdit={canEdit}
        />

        {/* ── Roster ─────────────────────────────────────────────────────── */}
        <section
          className={adminCard("mt-4 overflow-hidden")}
          data-admin-team-roster={roster.length}
        >
          <header className="border-b border-admin-line px-4 py-3.5 sm:px-5">
            <h2 className={ADMIN_TITLE}>Roster ({roster.length})</h2>
            <p className={cn(ADMIN_NOTE, "mt-1 max-w-[78ch]")}>
              The manager sits first. Removing the manager is refused — hand management over to
              another member first, which moves both roles in one transaction.
            </p>
          </header>
          <div className="admin-scroll overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-admin-line text-left">
                  <th scope="col" className={HEAD_CELL}>
                    Name
                  </th>
                  <th scope="col" className={HEAD_CELL}>
                    Role
                  </th>
                  <th scope="col" className={HEAD_CELL}>
                    Sex
                  </th>
                  <th scope="col" className={HEAD_CELL}>
                    Joined
                  </th>
                  {canEdit ? (
                    <th scope="col" className={cn(HEAD_CELL, "text-right")}>
                      Actions
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {roster.map((member) => (
                  <tr
                    key={member.userId}
                    className="border-b border-admin-line last:border-0"
                    data-admin-roster-row={member.userId}
                  >
                    <td className={cn(CELL, "text-admin-ink")}>{member.displayName}</td>
                    <td className={CELL}>
                      {member.role === "manager" ? (
                        <AdminPill tone="accent">Captain</AdminPill>
                      ) : (
                        "Member"
                      )}
                    </td>
                    <td className={CELL}>{adminTeamSexLabel(member.sex)}</td>
                    <td className={cn(CELL, "whitespace-nowrap font-mono text-[12px]")}>
                      {ADMIN_TEAM_DATE.format(member.joinedAt)}
                    </td>
                    {canEdit ? (
                      <td className={cn(CELL, "text-right")}>
                        {member.role === "manager" ? (
                          <span className="text-admin-muted">—</span>
                        ) : (
                          <AdminTeamMemberActions
                            slug={team.slug}
                            userId={member.userId}
                            name={member.displayName}
                          />
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Invitations, and the one power a manager has not ───────────── */}
        <section
          className={adminCard("mt-4 p-4 sm:p-5")}
          data-admin-team-invitations={invitations.length === 0 ? "empty" : invitations.length}
        >
          <h2 className={ADMIN_TITLE}>Pending invitations ({invitations.length})</h2>
          <p className={cn(ADMIN_NOTE, "mt-1 max-w-[78ch]")}>
            A roster has no cap, so invitations are never refused for space. Resending reissues the
            token — the previous link stops working at once and the 30-day clock restarts.
          </p>

          {canEdit ? <AdminInviteOnBehalf slug={team.slug} /> : null}

          {invitations.length === 0 ? (
            <p className={cn(ADMIN_NOTE, "mt-3")} data-admin-invitations-empty="">
              Nothing is outstanding.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-admin-line">
              {invitations.map((invitation) => (
                <li
                  key={invitation.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                  data-admin-invitation-row={invitation.id}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-admin-ink">{invitation.email}</p>
                    <p className={cn(ADMIN_NOTE, "mt-0.5")}>
                      Expires {ADMIN_TEAM_DATETIME.format(invitation.expiresAt)}
                      {invitation.onBehalf ? " · sent by the organiser on the team's behalf" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {invitation.onBehalf ? (
                      <span data-admin-invitation-on-behalf={invitation.id}>
                        <AdminPill tone="accent">On behalf</AdminPill>
                      </span>
                    ) : null}
                    {canEdit ? <AdminInvitationActions invitationId={invitation.id} /> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Request queue ──────────────────────────────────────────────── */}
        <section
          className={adminCard("mt-4 p-4 sm:p-5")}
          data-admin-team-requests={requests.length === 0 ? "empty" : requests.length}
        >
          <h2 className={ADMIN_TITLE}>Join requests ({requests.length})</h2>
          <p className={cn(ADMIN_NOTE, "mt-1 max-w-[78ch]")}>
            Runners who entered the team code or knocked from the public list. Accepting re-runs
            eligibility inside the seat transaction, so a request can still be refused here if the
            roster filled up in the meantime.
          </p>

          {requests.length === 0 ? (
            <p className={cn(ADMIN_NOTE, "mt-3")} data-admin-requests-empty="">
              Nobody is waiting.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-admin-line">
              {requests.map((pending) => (
                <li
                  key={pending.request.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                  data-admin-request-row={pending.request.id}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-admin-ink">{pending.displayName}</p>
                    <p className={cn(ADMIN_NOTE, "mt-0.5")}>
                      Filed {ADMIN_TEAM_DATETIME.format(pending.request.createdAt)}
                    </p>
                  </div>
                  {canEdit ? <AdminJoinRequestActions requestId={pending.request.id} /> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── The manager's own controls ─────────────────────────────────── */}
        {canEdit ? (
          <div className="mt-4">
            <AdminTeamSettings
              slug={team.slug}
              code={team.code}
              initial={{
                name: team.name,
                region: team.region,
                description: team.description ?? "",
                recruiting: team.recruiting,
              }}
            />
          </div>
        ) : null}
      </div>
    </AdminPage>
  );
}
