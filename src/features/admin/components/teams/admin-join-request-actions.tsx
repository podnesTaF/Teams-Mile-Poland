"use client";

import { useState, useTransition } from "react";

import { adminButton } from "@/features/admin/components/shell/admin-button";
import { adminTeamRefusal } from "@/features/admin/components/teams/refusal";
import { decideJoinRequest } from "@/features/teams/actions/join-requests";
import { useRouter } from "@/i18n/navigation";

/**
 * Accept / Decline on one pending join request of `/admin/teams/[slug]` (#63).
 *
 * `decideJoinRequest` resolves the team from the request row itself and runs
 * `requireTeamManagerOrAdmin` on it, so the organiser needs to pass nothing but
 * the request id — and an accept re-runs eligibility inside the locking
 * transaction, which is why a refusal here can be `roster_full` or
 * `sex_balance` even though the queue rendered a moment ago.
 */
export function AdminJoinRequestActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [refused, setRefused] = useState<{ reason: string; text: string } | null>(null);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [pending, startTransition] = useTransition();

  function run(decision: "accept" | "decline") {
    if (pending) return;
    setRefused(null);
    setBusy(decision);
    startTransition(async () => {
      const result = await decideJoinRequest(requestId, decision);
      setBusy(null);
      if (!result.ok) {
        setRefused({ reason: result.reason, text: adminTeamRefusal(result.reason) });
        return;
      }
      router.refresh();
    });
  }

  return (
    <span
      className="inline-flex flex-wrap items-center gap-2"
      data-admin-join-request-actions={requestId}
    >
      <button
        type="button"
        className={adminButton("primary")}
        disabled={pending}
        onClick={() => run("accept")}
      >
        {busy === "accept" ? "Accepting…" : "Accept"}
      </button>
      <button
        type="button"
        className={adminButton("quiet")}
        disabled={pending}
        onClick={() => run("decline")}
      >
        {busy === "decline" ? "Declining…" : "Decline"}
      </button>
      {refused ? (
        <span
          className="text-[12.5px] text-admin-warn"
          role="alert"
          data-admin-refused={refused.reason}
        >
          {refused.text}
        </span>
      ) : null}
    </span>
  );
}
