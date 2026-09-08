"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useRouter } from "@/i18n/navigation";

import { withdrawJoinRequest } from "../actions/join-requests";

/**
 * "Withdraw" on one of the runner's own pending requests, on the profile.
 *
 * A plain button rather than #62's `ConfirmButton`: withdrawing is not
 * destructive — the runner can knock again the moment they change their mind,
 * and the profile's pending-invitation list next to it answers Accept / Decline
 * with one press too. A confirm dialog here would be heavier than the thing it
 * guards.
 */
export function JoinRequestWithdraw({ requestId }: { requestId: string }) {
  const t = useTranslations("teams.requests");
  const tReasons = useTranslations("teams.reasons");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function withdraw() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await withdrawJoinRequest(requestId);
      if (!result.ok) {
        setError(tReasons(result.reason));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="iv-actions" data-join-request-withdraw={requestId}>
      <button
        type="button"
        className="btn btn-stroke-dark btn-sm"
        onClick={withdraw}
        disabled={pending}
      >
        {pending ? t("withdrawing") : t("withdraw")}
      </button>
      {error ? (
        <span className="ff-error-msg" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
