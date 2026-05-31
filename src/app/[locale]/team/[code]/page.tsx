import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";

import "@/app/landing.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { CaptainControls } from "@/features/team/components/captain-controls";
import { InviteLink } from "@/features/team/components/invite-link";
import { RosterList } from "@/features/team/components/roster-list";
import { SignOutButton } from "@/features/team/components/sign-out-button";
import { MAX_TEAM_SIZE } from "@/features/team/constants";
import { makeInviteUrl } from "@/features/registration/data";
import {
  getRosterByTeamId,
  getTeamByCode,
  normalizeTeamCode,
} from "@/features/team/data";
import { getTeamSession } from "@/lib/auth/team-session";
import { defaultLocale } from "@/lib/i18n/config";

function teamPath(locale: string, code: string, suffix = "") {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return `${prefix}/team/${encodeURIComponent(code)}${suffix}`;
}

export default async function TeamDashboardPage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code: rawCode } = await params;
  setRequestLocale(locale);

  const code = normalizeTeamCode(decodeURIComponent(rawCode));
  const team = await getTeamByCode(code);
  if (!team) {
    redirect(teamPath(locale, code, "/access?error=invalid"));
  }

  const session = await getTeamSession();
  if (!session || session.teamId !== team.id) {
    redirect(teamPath(locale, code, "/access"));
  }

  const roster = await getRosterByTeamId(team.id);
  const t = await getTranslations("team.dashboard");
  const paidCount = roster.members
    .concat(roster.captain ? [roster.captain] : [])
    .filter((r) => r.paymentStatus === "paid" || r.paymentStatus === "free").length;

  const emptyCount = Math.max(0, (team.size ?? MAX_TEAM_SIZE) - roster.count);

  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap">
          <section className="iv-card">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <span className="iv-eyebrow">{t("eyebrow")}</span>
                <h1 className="iv-title">{team.name}</h1>
                <p className="iv-meta">
                  {team.code} · {t(`status.${team.status}`)}
                </p>
              </div>
              <SignOutButton code={team.code} locale={locale} />
            </div>

            <div className="iv-grid">
              <Info label={t("roster")} value={`${roster.count} / ${team.size ?? MAX_TEAM_SIZE}`} />
              <Info label={t("paid")} value={String(paidCount)} />
              <Info
                label={t("captainLabel")}
                value={roster.captain?.fullName ?? t("captainPending")}
              />
              <Info label={t("yourRole")} value={t(`roles.${session.role}`)} />
            </div>
          </section>

          <section className="iv-card">
            <h2 className="iv-section-title">{t("rosterTitle")}</h2>
            <RosterList
              isCaptain={session.role === "captain"}
              teamCode={team.code}
              locale={locale}
              emptyCount={emptyCount}
              entries={[
                ...(roster.captain
                  ? [
                      {
                        id: roster.captain.id,
                        fullName: roster.captain.fullName,
                        email: roster.captain.email,
                        paymentStatus: roster.captain.paymentStatus,
                        role: "captain" as const,
                      },
                    ]
                  : []),
                ...roster.members.map((m) => ({
                  id: m.id,
                  fullName: m.fullName,
                  email: m.email,
                  paymentStatus: m.paymentStatus,
                  role: "member" as const,
                })),
              ]}
            />
          </section>

          <section className="iv-share">
            <span className="iv-eyebrow" style={{ color: "rgba(255,255,255,0.85)" }}>
              {t("inviteEyebrow")}
            </span>
            <p className="iv-share__hint">{t("shareHint")}</p>
            <InviteLink
              url={makeInviteUrl(team.code)}
              copyLabel={t("copyLink")}
              copiedLabel={t("copied")}
            />
            <p className="iv-share__code-line">
              {t("orShareCode")} <b>{team.code}</b>
            </p>
          </section>

          {session.role === "captain" ? (
            <CaptainControls
              teamCode={team.code}
              teamName={team.name}
              status={team.status}
              locale={locale}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="iv-info">
      <div className="iv-info__label">{label}</div>
      <div className="iv-info__value">{value}</div>
    </div>
  );
}

