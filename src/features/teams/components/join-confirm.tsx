"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useRouter } from "@/i18n/navigation";

import { requestToJoin } from "../actions/join-requests";

/**
 * The "Ask to join" button on `/teams/join/[code]`.
 *
 * Two outcomes, because `requestToJoin` has two: a runner who was already
 * invited is admitted through that invitation and lands on the team page, and
 * everybody else gets a pending request and a line saying the manager has been
 * told. `joined` is what distinguishes them — the runner should not be told
 * "we passed your request on" when they are already on the roster.
 *
 * The page has pre-evaluated eligibility and only renders this island when the
 * answer was yes, so an error here is a race (the last seat went, the runner
 * joined another team in this category in another tab). It is rendered in place
 * from `teams.reasons` rather than navigated to.
 */
export function JoinConfirm({ code }: { code: string }) {
  const t = useTranslations("teams.requests");
  const tReasons = useTranslations("teams.reasons");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function ask() {
    if (pending || sent) return;
    setError(null);
    startTransition(async () => {
      const result = await requestToJoin(code);
      if (!result.ok) {
        setError(tReasons(result.reason));
        return;
      }
      if (result.joined) {
        router.push(`/teams/${result.teamSlug}`);
        return;
      }
      setSent(true);
      router.refresh();
    });
  }

  if (sent) {
    return (
      <div className="banner banner--ok" role="status" data-join-sent="1">
        {t("sentBody")}
      </div>
    );
  }

  return (
    <div className="iv-actions" data-join-confirm={code}>
      <button type="button" className="btn btn-red" onClick={ask} disabled={pending}>
        {pending ? t("asking") : t("askToJoin")}
      </button>
      {error ? (
        <span className="ff-error-msg" role="alert" data-join-error="1">
          {error}
        </span>
      ) : null}
    </div>
  );
}
