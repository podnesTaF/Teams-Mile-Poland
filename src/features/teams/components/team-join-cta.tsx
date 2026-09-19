import { getTranslations } from "next-intl/server";

import type { UserTeamRow } from "@/db/schema/user-teams";
import { Link } from "@/i18n/navigation";
import type { SessionUser } from "@/lib/auth/user-session";

import { getEligibilityCandidate } from "../data";
import { checkEligibility, type RosterSeat } from "../eligibility";
import { teamGateState } from "../guards";
import { getPendingInvitationForEmail, isInvitationExpired } from "../invitations";
import { getPendingJoinRequest } from "../join-requests";
import { JoinConfirm } from "./join-confirm";
import { JoinRequestWithdraw } from "./join-request-withdraw";

/**
 * The call to action a **non-member** sees under the team card on
 * `/teams/[slug]` — the answer to "I found this team, now what?".
 *
 * Before this block existed the public team page ended at "roster names are
 * shown to members only" and the only door was the tile on `/teams`; a runner
 * who clicked the team's *name* on that tile landed here with nothing to press.
 *
 * One card, one of six states, decided in this order:
 *
 *  1. **Request pending** — "Request sent", with Withdraw. Shown whether or not
 *     the team is still recruiting: the knock already happened.
 *  2. **Invited** — the captain has already asked *them*; one press admits them
 *     through that invitation (`requestToJoin` prefers it over a new request).
 *  3. **Not recruiting** — a quiet notice and a way back to the list. The join
 *     link is *not* offered: the team code is the captain's private door and a
 *     team that is not recruiting has not opened it to strangers.
 *  4. **Signed out** — a link to the join page, which owns the sign-in →
 *     verify → profile chain and brings the runner back to it.
 *  5. **Signed in but gated** (unverified, incomplete profile, under age) — the
 *     same link; the join page renders the specific gate in place.
 *  6. **Eligible** — the "Send request" island right here, so a signed-in runner
 *     asks to join in one press without a second page that repeats the card.
 *     An ineligible runner sees the reason instead of a button that can only
 *     refuse (PRD #57, user story 30).
 *
 * Every state is a `data-team-join` value so HTTP checks can grep for it.
 */
export async function TeamJoinCta({
  team,
  seats,
  user,
}: {
  team: UserTeamRow;
  seats: readonly RosterSeat[];
  user: SessionUser | null;
}) {
  const t = await getTranslations("teams.requests");
  const tReasons = await getTranslations("teams.reasons");

  const joinHref = `/teams/join/${encodeURIComponent(team.code)}`;
  const gate = teamGateState(user);

  if (user) {
    const pending = await getPendingJoinRequest(team.id, user.id);
    if (pending) {
      return (
        <Card state="pending" eyebrow={t("ctaEyebrow")} title={t("sentTitle")}>
          <p className="iv-sub">{t("pendingBody", { team: team.name })}</p>
          <p className="iv-sub team-join__body">{t("sentBody")}</p>
          <JoinRequestWithdraw requestId={pending.id} />
        </Card>
      );
    }

    const invitation = await getPendingInvitationForEmail(team.id, user.email);
    if (invitation && !isInvitationExpired(invitation)) {
      return (
        <Card state="invited" eyebrow={t("ctaEyebrow")} title={t("invitedTitle")}>
          <p className="iv-sub">{t("invitedNotice", { team: team.name })}</p>
          {gate === null ? (
            <JoinConfirm code={team.code} label={t("acceptInvitation")} />
          ) : (
            <div className="iv-actions">
              <Link className="btn btn-red" href={joinHref}>
                {t("acceptInvitation")}
              </Link>
            </div>
          )}
        </Card>
      );
    }
  }

  if (!team.recruiting) {
    return (
      <Card state="closed" eyebrow={t("ctaEyebrow")} title={t("notRecruitingTitle")}>
        <p className="iv-sub">{t("notRecruitingBody", { team: team.name })}</p>
        <div className="iv-actions">
          <Link className="btn btn-stroke-dark" href="/teams">
            {t("browseCta")}
          </Link>
        </div>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card state="auth" eyebrow={t("ctaEyebrow")} title={t("ctaTitle", { team: team.name })}>
        <p className="iv-sub">{t("ctaBody")}</p>
        <div className="iv-actions">
          <Link className="btn btn-red" href={joinHref}>
            {t("askToJoin")}
          </Link>
        </div>
        <p className="iv-share__hint">{t("signInHint")}</p>
      </Card>
    );
  }

  if (gate !== null) {
    return (
      <Card state={gate} eyebrow={t("ctaEyebrow")} title={t("ctaTitle", { team: team.name })}>
        <p className="iv-sub">{t("ctaBody")}</p>
        <div className="iv-actions">
          <Link className="btn btn-red" href={joinHref}>
            {t("askToJoin")}
          </Link>
        </div>
        <p className="iv-share__hint">{t("ctaGateHint")}</p>
      </Card>
    );
  }

  const candidate = await getEligibilityCandidate(user.id);
  const eligibility = candidate
    ? checkEligibility({ category: team.category }, seats, candidate)
    : ({ ok: false, reason: "wrong_category" } as const);

  if (!eligibility.ok) {
    return (
      <Card
        state={eligibility.reason}
        eyebrow={t("ctaEyebrow")}
        title={t("ctaTitle", { team: team.name })}
      >
        <div className="banner banner--warn" role="status">
          {tReasons(eligibility.reason)}
        </div>
        <div className="iv-actions">
          <Link className="btn btn-stroke-dark" href="/teams">
            {t("browseCta")}
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card state="offer" eyebrow={t("ctaEyebrow")} title={t("ctaTitle", { team: team.name })}>
      <p className="iv-sub">{t("ctaBody")}</p>
      <JoinConfirm code={team.code} />
      <p className="iv-share__hint">{t("confirmHint")}</p>
    </Card>
  );
}

function Card({
  state,
  eyebrow,
  title,
  children,
}: {
  state: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="iv-card team-join" data-team-join={state}>
      <span className="iv-eyebrow">{eyebrow}</span>
      <h2 className="iv-title pf-h2 team-join__title">{title}</h2>
      {children}
    </section>
  );
}
