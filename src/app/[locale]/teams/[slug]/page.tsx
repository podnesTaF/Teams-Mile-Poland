import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "@/app/series-flows.css";
import "@/app/[locale]/wallet/wallet.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import {
  EntryEnterButton,
  type EnterableEvent,
} from "@/features/teams/components/entry-enter-button";
import { EntryList } from "@/features/teams/components/entry-list";
import { TeamCard } from "@/features/teams/components/team-card";
import { TeamJoinCta } from "@/features/teams/components/team-join-cta";
import { TeamManagerPanel } from "@/features/teams/components/team-manager-panel";
import { TeamRoster } from "@/features/teams/components/team-roster";
import { TeamShare } from "@/features/teams/components/team-share";
import { TeamTreasury, userIdFromReference } from "@/features/teams/components/team-treasury";
import {
  getManagerFirstName,
  getManagerFirstNames,
  getTeamBySlug,
  getTeamRoster,
} from "@/features/teams/data";
import { summarizeRoster } from "@/features/teams/eligibility";
import { getOpenTeamEvents, listEntriesForTeam } from "@/features/teams/entries";
import { getAcerBalance, getTeamAcerBalance, listWalletTransactions } from "@/features/wallet/data";
import { teamEntryFeeMinor } from "@/features/wallet/entry-fees";
import { isTreasuryPayoutEnabled } from "@/features/wallet/transfers";
import { Link } from "@/i18n/navigation";
import { getAppUrl } from "@/lib/app-url";
import { getUser, userCan } from "@/lib/auth/user-session";
import { getAllEvents } from "@/lib/events/store";
import { localePath } from "@/lib/i18n/config";

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

/**
 * One team, in three views layered on top of each other:
 *
 *  - **public** — the card: name, region, category, the runner count,
 *    description, the manager's first name. No roster names, ever. Under it,
 *    the join call to action ({@link TeamJoinCta}): ask to join, or why not.
 *  - **member** — plus the roster with names and roles, the runner count (with
 *    the men/women split on mixed teams), the code and the share link.
 *  - **manager** — plus the edit form, the code rotation and the recruiting
 *    toggle. An admin holding `edit` sees the manager view of any team.
 *
 * Dynamic on purpose (no `generateStaticParams`): what this page shows depends
 * on who is asking.
 */
export default async function TeamPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const team = await getTeamBySlug(slug);
  if (!team) notFound();

  const t = await getTranslations("teams.page");
  const user = await getUser();
  const roster = await getTeamRoster(team.id);
  const rosterSummary = summarizeRoster(team.category, roster);
  const managerFirstName = await getManagerFirstName(team.managerUserId);

  const isOnRoster = user ? roster.some((member) => member.userId === user.id) : false;
  // An admin who can read the panel sees the roster; only `edit` gets the
  // management controls (a check-in volunteer or viewer must not mutate).
  const isMember = isOnRoster || userCan(user, "view");
  const isManager = Boolean(user) && (team.managerUserId === user?.id || userCan(user, "edit"));

  const joinUrl = `${getAppUrl()}${localePath(locale, `/teams/join/${team.code}`)}`;

  // Team entry (PRD #64, #67). Two blocks, both read here so the components
  // stay dumb: the manager's "Enter" list of open team events, and the Entries
  // list every member sees.
  //
  // The Enter list is read for the manager only — a plain member cannot enter,
  // and offering them a button that answers `forbidden` is worse than not
  // offering it. `getOpenTeamEvents` already excludes the frozen legacy night.
  const entries = isMember ? await listEntriesForTeam(team.id) : [];
  const enterableEvents: EnterableEvent[] = isManager
    ? (await getOpenTeamEvents()).map((event) => ({
        slug: event.slug,
        name: event.name,
        shortDate: event.shortDate,
        entryId: entries.find((row) => row.entry.eventSlug === event.slug)?.entry.id ?? null,
        // Priced through the helper, never off the column (ADR 0013), so the
        // number beside the button is the number `enterTeam` pre-checks and
        // the number `createEntryRows` debits.
        feeMinor: teamEntryFeeMinor(event),
      }))
    : [];
  // Names for the Entries list, including events that have since closed — the
  // entry outlives `registration_open`, so `getOpenTeamEvents` cannot name it.
  const eventNames: Record<string, string> =
    entries.length > 0
      ? Object.fromEntries((await getAllEvents()).map((event) => [event.slug, event.name]))
      : {};

  // Team treasury (ADR 0012), members only. The balance and the last few
  // movements are read here so the section stays dumb; the viewer's own wallet
  // is read only for a person on the roster, because only they may pay in.
  // Payouts are a manager affordance and stay off until the Terms are revised
  // (`isTreasuryPayoutEnabled`); the action refuses either way.
  const treasuryMinor = isMember ? await getTeamAcerBalance(team.id) : 0;
  const viewerBalanceMinor = isOnRoster && user ? await getAcerBalance(user.id) : 0;
  const recent = isMember
    ? (await listWalletTransactions({ teamId: team.id }, { pageSize: 5 })).rows
    : [];
  const counterpartyNames = await getManagerFirstNames(
    recent.map((row) => userIdFromReference(row.reference)).filter((id): id is string => !!id),
  );
  const payout =
    isManager && isTreasuryPayoutEnabled()
      ? {
          candidates: roster.map((member) => ({
            userId: member.userId,
            displayName: member.displayName,
          })),
        }
      : null;

  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap">
          {isMember ? (
            <Link href="/profile" className="detail-back">
              ← {t("back")}
            </Link>
          ) : (
            <Link href="/teams" className="detail-back">
              ← {t("backToTeams")}
            </Link>
          )}

          <TeamCard team={team} roster={rosterSummary} managerFirstName={managerFirstName} />

          {isMember ? (
            <>
              <TeamRoster
                slug={team.slug}
                roster={roster}
                summary={rosterSummary}
                viewerUserId={user?.id ?? null}
                isManager={isManager}
                treasuryMinor={treasuryMinor}
              />
              <TeamShare code={team.code} joinUrl={joinUrl} />
              <TeamTreasury
                slug={team.slug}
                locale={locale}
                treasuryMinor={treasuryMinor}
                viewerBalanceMinor={viewerBalanceMinor}
                canContribute={isOnRoster}
                payout={payout}
                recent={recent}
                names={counterpartyNames}
              />
            </>
          ) : (
            <>
              <TeamJoinCta team={team} seats={roster} user={user} />
              <p className="iv-share__hint" data-team-view="public">
                {t("publicRosterHidden")}
              </p>
            </>
          )}

          {isManager ? (
            <EntryEnterButton
              teamSlug={team.slug}
              events={enterableEvents}
              locale={locale}
              treasuryMinor={treasuryMinor}
            />
          ) : null}

          {isMember ? (
            <EntryList teamSlug={team.slug} entries={entries} eventNames={eventNames} />
          ) : null}

          {isManager ? <TeamManagerPanel team={team} locale={locale} /> : null}
        </div>
      </main>
    </div>
  );
}
