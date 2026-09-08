import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import "@/app/landing.css";
import "@/app/series-flows.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { ProfileForm } from "@/features/profile/components/profile-form";
import type { ProfileInput } from "@/features/profile/schemas";
import { DecisionButtons } from "@/features/teams/components/invitation-decision";
import { TeamCard } from "@/features/teams/components/team-card";
import {
  getEligibilityCandidate,
  getManagerFirstName,
  getRosterSeats,
} from "@/features/teams/data";
import { checkEligibility, computeCompleteness } from "@/features/teams/eligibility";
import { teamGateState } from "@/features/teams/guards";
import {
  getInvitationByToken,
  invitePath,
  isInvitationExpired,
  markInvitationExpired,
} from "@/features/teams/invitations";
import { formatTeamDate } from "@/features/teams/mail-invitations";
import { Link } from "@/i18n/navigation";
import { getUser, type SessionUser } from "@/lib/auth/user-session";
import { defaultLocale } from "@/lib/i18n/config";

type PageProps = {
  params: Promise<{ locale: string; token: string }>;
};

/**
 * The accept screen an invitation link opens.
 *
 * The **token in the URL is the whole state** — there is no cookie drop — so
 * the gate chain only has to carry `redirectTo` back here and the invitation is
 * still there afterwards. A visitor without an account is sent to sign-up with
 * the invited address prefilled, and sign-up → verify → profile hand that
 * `redirectTo` along until they land back on this page, signed in.
 *
 * Every refusal is its own state, never a generic error: expired, used,
 * declined, revoked, and each of the five eligibility answers. Eligibility is
 * pre-evaluated for the viewer so the buttons are simply absent when pressing
 * them could only fail — the same rule the action re-checks under the team-row
 * lock.
 *
 * Dynamic: what it renders depends entirely on who opens it.
 */
export default async function TeamInvitePage({ params }: PageProps) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("teams.invitations");
  const tReasons = await getTranslations("teams.reasons");
  const tForm = await getTranslations("teams.form");

  const found = await getInvitationByToken(token);
  const user = await getUser();

  // ── signed out ──────────────────────────────────────────────────────────
  // Unknown token first: a visitor with a broken link should be told so rather
  // than pushed through a sign-up they have no reason to complete.
  if (!user) {
    if (!found) {
      return (
        <Shell>
          <Notice state="invalid" title={t("invalidTitle")} body={t("invalidBody")} />
        </Shell>
      );
    }
    const back = invitePath(token);
    const dest = `/auth/sign-up?email=${encodeURIComponent(
      found.invitation.email,
    )}&redirectTo=${encodeURIComponent(back)}`;
    redirect(locale === defaultLocale ? dest : `/${locale}${dest}`);
  }

  // ── the user gate chain, rendered in place with `redirectTo` threaded ────
  const gate = teamGateState(user);
  if (gate === "verify") {
    return (
      <Shell>
        <Notice state="verify" title={t("verifyTitle")} body={t("verifyBody")}>
          <Link
            className="btn btn-red"
            href={`/auth/verify-email?redirectTo=${encodeURIComponent(invitePath(token))}`}
          >
            {t("verifyCta")}
          </Link>
        </Notice>
      </Shell>
    );
  }
  if (gate === "profile") {
    return (
      <Shell>
        <div className="center-narrow" style={{ maxWidth: 620 }} data-team-gate="profile">
          <div className="page-head" style={{ marginBottom: 16 }}>
            <span className="iv-eyebrow">{t("eyebrow")}</span>
            <h1 className="iv-title">{t("profileGateTitle")}</h1>
          </div>
          <div className="banner banner--info" style={{ marginBottom: 16 }}>
            <div className="banner__body">
              <div className="banner__txt">{t("profileGateBody")}</div>
            </div>
          </div>
          <ProfileForm initial={profileInitial(user)} redirectTo={invitePath(token)} />
        </div>
      </Shell>
    );
  }
  if (gate === "age") {
    return (
      <Shell>
        <Notice state="age" title={t("ageTitle")} body={t("ageBody")}>
          <Link className="btn btn-stroke-dark" href="/profile">
            {t("profileCta")}
          </Link>
        </Notice>
      </Shell>
    );
  }

  if (!found) {
    return (
      <Shell>
        <Notice state="invalid" title={t("invalidTitle")} body={t("invalidBody")} />
      </Shell>
    );
  }

  const { invitation, team } = found;

  // ── the invitation's own states ─────────────────────────────────────────
  if (invitation.status === "pending" && isInvitationExpired(invitation)) {
    // Lazy transition: `expires_at` is the truth, the status column catches up
    // the first time anyone looks. Nothing schedules this.
    await markInvitationExpired(invitation.id);
  }
  const status =
    invitation.status === "pending" && isInvitationExpired(invitation)
      ? "expired"
      : invitation.status;

  if (status !== "pending") {
    const state =
      status === "expired"
        ? { key: "expired", title: t("expiredTitle"), body: t("expiredBody") }
        : status === "revoked"
          ? { key: "revoked", title: t("revokedTitle"), body: t("revokedBody") }
          : status === "declined"
            ? { key: "declined", title: t("declinedTitle"), body: t("declinedBody") }
            : { key: "used", title: t("usedTitle"), body: t("usedBody") };
    return (
      <Shell>
        <Notice state={state.key} title={state.title} body={state.body}>
          <Link className="btn btn-stroke-dark" href="/profile">
            {t("profileCta")}
          </Link>
        </Notice>
      </Shell>
    );
  }

  // ── the offer ───────────────────────────────────────────────────────────
  const seats = (await getRosterSeats([team.id])).get(team.id) ?? [];
  const completeness = computeCompleteness(team.category, seats);
  const managerFirstName = await getManagerFirstName(team.managerUserId);
  const candidate = await getEligibilityCandidate(user.id);
  const eligibility = candidate
    ? checkEligibility({ category: team.category }, seats, candidate)
    : ({ ok: false, reason: "wrong_category" } as const);

  return (
    <Shell>
      <div className="center-narrow" style={{ maxWidth: 720 }} data-invite-state="offer">
        <TeamCard
          team={team}
          completeness={completeness}
          managerFirstName={managerFirstName}
        />

        <section className="iv-card" data-invite-decision={eligibility.ok ? "open" : eligibility.reason}>
          <span className="iv-eyebrow">{t("eyebrow")}</span>
          <h2 className="iv-title">{t("offerTitle", { team: team.name })}</h2>
          <p className="iv-sub">
            {invitation.onBehalf
              ? t("offerBodyOnBehalf", {
                  team: team.name,
                  category: tForm(`categoryOption.${team.category}`),
                })
              : t("offerBody", {
                  team: team.name,
                  category: tForm(`categoryOption.${team.category}`),
                })}
          </p>
          <p className="iv-share__hint">
            {t("invitedAddress", { email: invitation.email })} ·{" "}
            {t("expires", { date: formatTeamDate(invitation.expiresAt, locale) })}
          </p>

          {eligibility.ok ? (
            <DecisionButtons token={token} />
          ) : (
            <>
              <div className="banner banner--warn" role="status">
                {tReasons(eligibility.reason)}
              </div>
              <div className="iv-actions">
                <Link className="btn btn-stroke-dark" href="/profile">
                  {t("profileCta")}
                </Link>
              </div>
            </>
          )}
        </section>
      </div>
    </Shell>
  );
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

function Notice({
  state,
  title,
  body,
  children,
}: {
  state: string;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <section className="iv-card center-narrow" data-invite-state={state}>
      <span className="iv-eyebrow">{title}</span>
      <p className="iv-sub">{body}</p>
      <div className="iv-actions">{children}</div>
    </section>
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
