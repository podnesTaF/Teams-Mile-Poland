import { getTranslations, setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "@/app/series-flows.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { RecruitingList } from "@/features/teams/components/recruiting-list";
import { isTeamCategory } from "@/features/teams/config";
import { Link } from "@/i18n/navigation";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string }>;
};

/**
 * `/teams` — the public front door of team formation: every team that is
 * **Recruiting**, newest first, with a category filter.
 *
 * Public on purpose (PRD #57, cross-cutting decision 2). A runner with no
 * account can browse the whole list and only meets the gate chain when they
 * press "Ask to join" on a team's join page. That is also why the landing CTA
 * points here rather than at `/teams/new`: most people arrive looking for a
 * team, not to found one, and the create link sits on this page for the rest.
 *
 * Dynamic, not static: recruiting flags change whenever a manager edits a team,
 * and a cached list would send runners to teams that have stopped looking.
 * An unknown `?category=` is ignored rather than 404ing — a mistyped query
 * string should show the whole list, not an error.
 */
export default async function TeamsPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { category: raw } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations("teams.requests");
  const category = isTeamCategory(raw) ? raw : undefined;

  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap">
          <div className="page-head" style={{ marginBottom: 16 }}>
            <span className="iv-eyebrow">{t("listEyebrow")}</span>
            <h1 className="iv-title">{t("listTitle")}</h1>
            <p className="iv-sub">{t("listSubtitle")}</p>
          </div>

          <RecruitingList category={category} />

          <div className="iv-actions" style={{ marginTop: 24 }}>
            <Link className="btn btn-stroke-dark" href="/teams/new">
              {t("listCreateCta")}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
