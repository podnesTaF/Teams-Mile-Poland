import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import "@/app/landing.css";
import "@/app/series-flows.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { ProfileForm } from "@/features/profile/components/profile-form";
import type { ProfileInput } from "@/features/profile/schemas";
import { JoinConfirm } from "@/features/teams/components/join-confirm";
import { TeamCard } from "@/features/teams/components/team-card";
import {
  getEligibilityCandidate,
  getManagerFirstNames,
  getRosterSeats,
  getTeamByCode,
  getTeamMembership,
} from "@/features/teams/data";
import { checkEligibility, summarizeRoster } from "@/features/teams/eligibility";
import { teamGateState } from "@/features/teams/guards";
import { getPendingInvitationForEmail, isInvitationExpired } from "@/features/teams/invitations";
import { getPendingJoinRequest } from "@/features/teams/join-requests";
import { Link } from "@/i18n/navigation";
import { getUser, type SessionUser } from "@/lib/auth/user-session";

type PageProps = {
  params: Promise<{ locale: string; code: string }>;
};

/**
 * The confirm screen a **Team code** opens: this is the team, do you want to ask
 * to join it?
 *
 * **Viewing is public, the action is gated.** A stranger handed a code should be
 * able to see whose team it is before being asked to make an account, so the
 * card renders for everybody and the gate chain runs at the button — signed-out
 * gets a sign-in link carrying `redirectTo` back here, and sign-in → sign-up →
 * verify → profile hand it along until they land here signed in. Nothing about
 * the request is held in the URL, so nothing is lost on the way round.
 *
 * Eligibility is pre-evaluated for a signed-in viewer and the specific refusal
 * is rendered *instead of* the button — the same rule `requestToJoin` re-checks
 * before it writes, so a runner is never invited to press something that can
 * only fail. Two states come before it: already on the roster, and a request
 * already pending.
 *
 * A runner who holds a live invitation to this team is told so: pressing the
 * button admits them through that invitation rather than filing a request the
 * manager already answered by inviting them.
 *
 * Dynamic: an unknown code is a `notFound()`, and everything else depends on who
 * is asking.
 */
export default async function TeamJoinPage({ params }: PageProps) {
  const { locale, code } = await params;
  setRequestLocale(locale);

  const team = await getTeamByCode(code);
  if (!team) notFound();

  const t = await getTranslations("teams.requests");
  const tReasons = await getTranslations("teams.reasons");
  const tForm = await getTranslations("teams.form");

  const seats = (await getRosterSeats([team.id])).get(team.id) ?? [];
  const rosterSummary = summarizeRoster(team.category, seats);
  const managerFirstName =
    (await getManagerFirstNames([team.managerUserId])).get(team.managerUserId) ?? null;

  const card = (
    <TeamCard team={team} roster={rosterSummary} managerFirstName={managerFirstName} />
  );
  const back = joinPath(code);
  const user = await getUser();

  // ── signed out: the card, then the door ─────────────────────────────────
  if (!user) {
    return (
      <Shell>
        <Offer card={card} state="auth" title={t("confirmTitle", { team: team.name })}>
          <p className="iv-sub">
            {t("confirmBody", {
              team: team.name,
              category: tForm(`categoryOption.${team.category}`),
            })}
          </p>
          <div className="iv-actions">
            <Link
              className="btn btn-red"
              href={`/auth/sign-in?redirectTo=${encodeURIComponent(back)}`}
            >
              {t("askToJoin")}
            </Link>
          </div>
          <p className="iv-share__hint">{t("signInHint")}</p>
        </Offer>
      </Shell>
    );
  }

  // ── the user gate chain, rendered in place with `redirectTo` threaded ────
  const gate = teamGateState(user);
  if (gate === "verify") {
    return (
      <Shell>
        <Offer card={card} state="verify" title={t("verifyTitle")}>
          <p className="iv-sub">{t("verifyBody")}</p>
          <div className="iv-actions">
            <Link
              className="btn btn-red"
              href={`/auth/verify-email?redirectTo=${encodeURIComponent(back)}`}
            >
              {t("verifyCta")}
            </Link>
          </div>
        </Offer>
      </Shell>
    );
  }
  if (gate === "profile") {
    return (
      <Shell>
        <div className="center-narrow" style={{ maxWidth: 720 }} data-join-state="profile">
          {card}
          <div className="banner banner--info" style={{ margin: "16px 0" }}>
            <div className="banner__body">
              <div className="banner__txt">{t("profileGateBody")}</div>
            </div>
          </div>
          <ProfileForm initial={profileInitial(user)} redirectTo={back} />
        </div>
      </Shell>
    );
  }
  if (gate === "age") {
    return (
      <Shell>
        <Offer card={card} state="age" title={t("ageTitle")}>
          <p className="iv-sub">{t("ageBody")}</p>
          <div className="iv-actions">
            <Link className="btn btn-stroke-dark" href="/profile">
              {t("profileCta")}
            </Link>
          </div>
        </Offer>
      </Shell>
    );
  }

  // ── already in, or already knocked ──────────────────────────────────────
  if (await getTeamMembership(team.id, user.id)) {
    return (
      <Shell>
        <Offer card={card} state="member" title={t("memberTitle")}>
          <p className="iv-sub">{t("memberBody", { team: team.name })}</p>
          <div className="iv-actions">
            <Link className="btn btn-red" href={`/teams/${team.slug}`}>
              {t("openTeam")}
            </Link>
          </div>
        </Offer>
      </Shell>
    );
  }
  if (await getPendingJoinRequest(team.id, user.id)) {
    return (
      <Shell>
        <Offer card={card} state="pending" title={t("pendingTitle")}>
          <p className="iv-sub">{t("pendingBody", { team: team.name })}</p>
          <div className="iv-actions">
            <Link className="btn btn-stroke-dark" href="/profile#teams">
              {t("profileCta")}
            </Link>
          </div>
        </Offer>
      </Shell>
    );
  }

  // ── the offer ───────────────────────────────────────────────────────────
  const candidate = await getEligibilityCandidate(user.id);
  const eligibility = candidate
    ? checkEligibility({ category: team.category }, seats, candidate)
    : ({ ok: false, reason: "wrong_category" } as const);

  const invitation = await getPendingInvitationForEmail(team.id, user.email);
  const invited = invitation !== null && !isInvitationExpired(invitation);

  return (
    <Shell>
      <Offer
        card={card}
        state={eligibility.ok ? "offer" : eligibility.reason}
        title={t("confirmTitle", { team: team.name })}
      >
        <p className="iv-sub">
          {t("confirmBody", {
            team: team.name,
            category: tForm(`categoryOption.${team.category}`),
          })}
        </p>

        {eligibility.ok ? (
          <>
            {invited ? (
              <div className="banner banner--info" role="status" data-join-invited="1">
                {t("invitedNotice", { team: team.name })}
              </div>
            ) : null}
            <JoinConfirm code={code} />
            <p className="iv-share__hint">{t("confirmHint")}</p>
          </>
        ) : (
          <>
            <div className="banner banner--warn" role="status">
              {tReasons(eligibility.reason)}
            </div>
            <div className="iv-actions">
              <Link className="btn btn-stroke-dark" href="/teams">
                {t("browseCta")}
              </Link>
            </div>
          </>
        )}
      </Offer>
    </Shell>
  );
}

/** The locale-less path this page lives at — what every `redirectTo` carries. */
function joinPath(code: string): string {
  return `/teams/join/${encodeURIComponent(code)}`;
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap">{children}</div>
      </main>
    </div>
  );
}

/** The card plus one titled panel underneath — every state on this page. */
function Offer({
  card,
  state,
  title,
  children,
}: {
  card: ReactNode;
  state: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="center-narrow" style={{ maxWidth: 720 }} data-join-state={state}>
      {card}
      <section className="iv-card">
        <span className="iv-eyebrow">{title}</span>
        {children}
      </section>
    </div>
  );
}

/** Serialize a stored DOB (Date via mode:"date", or string) to YYYY-MM-DD. */
function toDateInput(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return value.toISOString().slice(0, 10);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return "";
}

function profileInitial(user: SessionUser): ProfileInput {
  const pu = user as SessionUser & {
    firstName?: string | null;
    lastName?: string | null;
    dateOfBirth?: unknown;
    sex?: "M" | "F" | null;
    club?: string | null;
    phone?: string | null;
  };
  return {
    firstName: pu.firstName ?? "",
    lastName: pu.lastName ?? "",
    dateOfBirth: toDateInput(pu.dateOfBirth),
    sex: (pu.sex ?? "") as ProfileInput["sex"],
    club: pu.club ?? "",
    phone: pu.phone ?? "",
  };
}
