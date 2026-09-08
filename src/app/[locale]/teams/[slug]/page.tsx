import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "@/app/series-flows.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import {
  EntryEnterButton,
  type EnterableEvent,
} from "@/features/teams/components/entry-enter-button";
import { EntryList } from "@/features/teams/components/entry-list";
import { TeamCard } from "@/features/teams/components/team-card";
import { TeamManagerPanel } from "@/features/teams/components/team-manager-panel";
import { TeamRoster } from "@/features/teams/components/team-roster";
import { TeamShare } from "@/features/teams/components/team-share";
import { getManagerFirstName, getTeamBySlug, getTeamRoster } from "@/features/teams/data";
import { computeCompleteness } from "@/features/teams/eligibility";
import { getOpenTeamEvents, listEntriesForTeam } from "@/features/teams/entries";
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
 *  - **public** — the card: name, region, category, count against target,
 *    description, the manager's first name. No roster names, ever.
 *  - **member** — plus the roster with names and roles, the completeness line
 *    (with the men/women split on mixed teams), the code and the share link.
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
  const completeness = computeCompleteness(team.category, roster);
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
      }))
    : [];
  // Names for the Entries list, including events that have since closed — the
  // entry outlives `registration_open`, so `getOpenTeamEvents` cannot name it.
  const eventNames: Record<string, string> =
    entries.length > 0
      ? Object.fromEntries((await getAllEvents()).map((event) => [event.slug, event.name]))
      : {};

  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap">
          <Link href="/profile" className="detail-back">
            ← {t("back")}
          </Link>

          <TeamCard
            team={team}
            completeness={completeness}
            managerFirstName={managerFirstName}
          />

          {isMember ? (
            <>
              <TeamRoster
                slug={team.slug}
                roster={roster}
                completeness={completeness}
                viewerUserId={user?.id ?? null}
                isManager={isManager}
              />
              <TeamShare code={team.code} joinUrl={joinUrl} />
            </>
          ) : (
            <p className="iv-share__hint" data-team-view="public">
              {t("publicRosterHidden")}
            </p>
          )}

          {isManager ? (
            <EntryEnterButton teamSlug={team.slug} events={enterableEvents} locale={locale} />
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
