"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useRouter } from "@/i18n/navigation";

import { decideJoinRequest } from "../actions/join-requests";

/**
 * Accept / Decline on one pending join request — the `DecisionButtons` island
 * of PRD #57's list (`{ pending, decision }`) in its manager-side form.
 *
 * Not the same component as `invitation-decision.tsx`: that one is the
 * *runner* answering an offer and calls `respondToInvitation` with a token; this
 * is the *manager* answering a knock and calls `decideJoinRequest` with a row
 * id. The props do not overlap and neither does the copy, so folding them into
 * one island would mean a discriminated union and two branches in every handler.
 *
 * A refusal renders in place from `teams.reasons` rather than navigating: after
 * a manager presses Accept, "the roster is full" or "they already hold a mixed
 * team" is the whole answer, and a redirect would throw it away. The re-check
 * that produces it runs under the team-row lock, so this is the only place the
 * manager can learn the request went stale.
 */
export function JoinRequestDecision({ requestId }: { requestId: string }) {
  const t = useTranslations("teams.requests");
  const tReasons = useTranslations("teams.reasons");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<"accept" | "decline" | null>(null);
  const [pending, startTransition] = useTransition();

  function decide(next: "accept" | "decline") {
    if (pending) return;
    setError(null);
    setDecision(next);
    startTransition(async () => {
      const result = await decideJoinRequest(requestId, next);
      if (!result.ok) {
        setDecision(null);
        setError(tReasons(result.reason));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="iv-actions" data-join-request-decision={requestId}>
      <button
        type="button"
        className="btn btn-red btn-sm"
        onClick={() => decide("accept")}
        disabled={pending}
      >
        {pending && decision === "accept" ? t("accepting") : t("accept")}
      </button>
      <button
        type="button"
        className="btn btn-stroke-dark btn-sm"
        onClick={() => decide("decline")}
        disabled={pending}
      >
        {pending && decision === "decline" ? t("declining") : t("decline")}
      </button>
      {error ? (
        <span className="field-msg" role="alert" data-join-request-error="1">
          {error}
        </span>
      ) : null}
    </div>
  );
}
