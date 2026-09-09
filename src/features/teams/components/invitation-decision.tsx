"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useRouter } from "@/i18n/navigation";

import { respondToInvitation } from "../actions/invitations";

/**
 * Accept / Decline — the `DecisionButtons` island from PRD #57's client-island
 * list (`{ pending, decision }`), used by the invite page and by the profile's
 * pending-invitation list.
 *
 * `token` is the raw token from the link on the invite page and the invitation
 * row id on the profile, where no raw token exists; the action resolves either
 * and, for the id, checks the address belongs to the signed-in account.
 *
 * A refusal is rendered from `teams.reasons` in place rather than navigating:
 * the eligibility answer ("you already hold a men's team") is the whole point
 * of pressing the button, and a redirect would throw it away.
 */
export function DecisionButtons({ token }: { token: string }) {
  const t = useTranslations("teams.invitations");
  const tReasons = useTranslations("teams.reasons");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<"accept" | "decline" | null>(null);
  const [pending, startTransition] = useTransition();

  function respond(next: "accept" | "decline") {
    if (pending) return;
    setError(null);
    setDecision(next);
    startTransition(async () => {
      const result = await respondToInvitation(token, next);
      if (!result.ok) {
        setDecision(null);
        setError(tReasons(result.reason));
        return;
      }
      if (next === "accept") {
        router.push(`/teams/${result.teamSlug}`);
      }
      router.refresh();
    });
  }

  return (
    <div className="iv-actions" data-invitation-decision={token}>
      <button
        type="button"
        className="btn btn-red"
        onClick={() => respond("accept")}
        disabled={pending}
      >
        {pending && decision === "accept" ? t("accepting") : t("accept")}
      </button>
      <button
        type="button"
        className="btn btn-stroke-dark"
        onClick={() => respond("decline")}
        disabled={pending}
      >
        {pending && decision === "decline" ? t("declining") : t("decline")}
      </button>
      {error ? (
        <span className="field-msg" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
