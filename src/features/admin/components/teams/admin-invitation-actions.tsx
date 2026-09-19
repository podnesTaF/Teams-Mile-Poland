"use client";

import { useState } from "react";

import { adminButton } from "@/features/admin/components/shell/admin-button";
import { ACTION_FAILED_TEXT, adminTeamRefusal } from "@/features/admin/components/teams/refusal";
import { resendInvitation, revokeInvitation } from "@/features/teams/actions/invitations";
import { useRouter } from "@/i18n/navigation";
import { useActionRun } from "@/lib/use-action-run";

/**
 * Resend / Revoke on one pending invitation of `/admin/teams/[slug]` (#63) —
 * the manager's two presses, run as the organiser through the same actions.
 *
 * Resend **reissues** the token: the previous link stops working the moment it
 * returns, and the 30-day clock restarts. That is why the label is "Resend"
 * and not "Send again" — there is only ever one live link per invitation.
 */
export function AdminInvitationActions({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [refused, setRefused] = useState<{ reason: string; text: string } | null>(null);
  const [busy, setBusy] = useState<"resend" | "revoke" | null>(null);
  const [pending, startTransition] = useActionRun(() =>
    setRefused({ reason: "failed", text: ACTION_FAILED_TEXT }),
  );

  function run(which: "resend" | "revoke") {
    if (pending) return;
    setRefused(null);
    setBusy(which);
    startTransition(async () => {
      const result =
        which === "resend"
          ? await resendInvitation(invitationId)
          : await revokeInvitation(invitationId);
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
      data-admin-invitation-actions={invitationId}
    >
      <button
        type="button"
        className={adminButton("stroke")}
        disabled={pending}
        onClick={() => run("resend")}
      >
        {busy === "resend" ? "Resending…" : "Resend"}
      </button>
      <button
        type="button"
        className={adminButton("quiet")}
        disabled={pending}
        onClick={() => run("revoke")}
      >
        {busy === "revoke" ? "Revoking…" : "Revoke"}
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
