import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "@/app/series-flows.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { EntryChecklist } from "@/features/teams/components/entry-checklist";
import { EntryManagerControls } from "@/features/teams/components/entry-manager-controls";
import { getTeamBySlug, getTeamMembership } from "@/features/teams/data";
import { getEntryByTeamAndEvent, getEntryMembers, getTeamEntryCandidates } from "@/features/teams/entries";
import { Link } from "@/i18n/navigation";
import { getUser, userCan } from "@/lib/auth/user-session";
import { getEventBySlug } from "@/lib/events/registry";
import { isPubliclyVisible } from "@/lib/events/store";
import { formatEventLongDate } from "@/lib/events/time";
import { isSeriesEvent } from "@/lib/events/types";

type PageProps = {
  params: Promise<{ locale: string; slug: string; eventSlug: string }>;
};

/**
 * One team's entry into one event (PRD #64, Routes → `/teams/[slug]/entries/[eventSlug]`).
 *
 * Three views on the same page, layered the way the team page layers its own:
 *
 *  - **member** — the checklist: who has confirmed, who has not. Read-only.
 *    A member wants to know whether their team is ready (user story 26).
 *  - **manager** (or an admin holding `edit`) — plus Remind, Add, Remove and
 *    Withdraw.
 *  - **checked in** — the manager's controls collapse to a notice: the
 *    composition fixed at the desk must not drift (user story 13).
 *
 * Dynamic on purpose, with no `generateStaticParams`: what it shows depends
 * entirely on who is asking, and the confirmation counts change all evening.
 *
 * Nobody outside the team sees it at all — an entry names every member of a
 * roster, and public surfaces show no roster names (PRD #57). A stranger gets
 * `notFound()` rather than a refusal page, so the URL does not confirm that the
 * entry exists.
 */
export default async function TeamEntryPage({ params }: PageProps) {
  const { locale, slug, eventSlug } = await params;
  setRequestLocale(locale);

  const team = await getTeamBySlug(slug);
  if (!team) notFound();

  const event = await getEventBySlug(eventSlug);
  // Same gate as the public event page: a `draft` is indistinguishable from a
  // slug that does not exist, and the frozen legacy night is not entered
  // through these tables at all (ADR 0008).
  if (!event || event.eventType !== "team" || !isSeriesEvent(event) || !isPubliclyVisible(event)) {
    notFound();
  }

  const entry = await getEntryByTeamAndEvent(team.id, eventSlug);
  if (!entry) notFound();

  const user = await getUser();
  const membership = user ? await getTeamMembership(team.id, user.id) : null;
  const isManager = Boolean(user) && (team.managerUserId === user?.id || userCan(user, "edit"));
  // `view` lets an organiser read any team's entry (the desk needs it); being on
  // the roster is what lets a member read their own.
  const canRead = isManager || Boolean(membership) || userCan(user, "view");
  if (!canRead) notFound();

  const t = await getTranslations("teams.entryPage");
  const members = await getEntryMembers(entry.id);
  const locked = entry.status !== "entered";

  // Roster members not on the entry — the Add select's options. Read only for
  // the manager: nobody else can add anyone, and this is the one place the page
  // would otherwise hand a plain member a list of ids they have no use for.
  const candidates = isManager
    ? (await getTeamEntryCandidates(team.id))
        .filter((candidate) => !members.some((member) => member.userId === candidate.userId))
        .map((candidate) => ({ userId: candidate.userId, displayName: candidate.displayName }))
    : [];

  return (
    <div className="ace-landing iv" data-entry-page={entry.id} data-entry-event={eventSlug}>
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap">
          <Link href={`/teams/${team.slug}`} className="detail-back">
            ← {t("back", { team: team.name })}
          </Link>

          <section className="iv-card">
            <span className="iv-eyebrow">{t("eyebrow")}</span>
            <h1 className="iv-title">{event.name}</h1>
            <p className="iv-meta">
              {formatEventLongDate(locale, event.date)} · {event.venue}, {event.city}
            </p>
            <p className="iv-meta" data-entry-team={team.slug}>
              {t("teamLine", { team: team.name })}
            </p>
            <p className="iv-share__hint" data-entry-rules-version={entry.ratingRulesVersion}>
              {t("rulesVersion", { version: entry.ratingRulesVersion })}
            </p>
          </section>

          <EntryChecklist
            locked={locked}
            members={members.map((member) => ({
              userId: member.userId,
              displayName: member.displayName,
              confirmed: member.confirmed,
              raceRole: member.raceRole,
              isReserve: member.isReserve,
            }))}
          />

          {isManager ? (
            <EntryManagerControls
              entryId={entry.id}
              teamSlug={team.slug}
              locked={locked}
              members={members.map((member) => ({
                userId: member.userId,
                displayName: member.displayName,
                confirmed: member.confirmed,
              }))}
              candidates={candidates}
            />
          ) : (
            <p className="iv-share__hint" data-entry-readonly="1">
              {t("memberNotice")}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
