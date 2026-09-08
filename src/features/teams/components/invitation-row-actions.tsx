"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useRouter } from "@/i18n/navigation";

import { resendInvitation, revokeInvitation } from "../actions/invitations";

/**
 * Resend / Revoke on one pending invitation in the manager's panel.
 *
 * Resend reissues the token, so the previous link stops working — that is why
 * the button is labelled "resend" and not "send again": there is only ever one
 * live link per invitation.
 */
export function InvitationRowActions({ invitationId }: { invitationId: string }) {
  const t = useTranslations("teams.invitations");
  const tReasons = useTranslations("teams.reasons");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"resend" | "revoke" | null>(null);
  const [pending, startTransition] = useTransition();

  function run(which: "resend" | "revoke") {
    if (pending) return;
    setError(null);
    setBusy(which);
    startTransition(async () => {
      const result =
        which === "resend"
          ? await resendInvitation(invitationId)
          : await revokeInvitation(invitationId);
      setBusy(null);
      if (!result.ok) {
        setError(tReasons(result.reason));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="reg-card__actions" data-invitation-actions={invitationId}>
      <button
        type="button"
        className="btn btn-sm btn-stroke-dark"
        onClick={() => run("resend")}
        disabled={pending}
      >
        {busy === "resend" ? t("resending") : t("resend")}
      </button>
      <button
        type="button"
        className="btn btn-sm btn-stroke-dark"
        onClick={() => run("revoke")}
        disabled={pending}
      >
        {busy === "revoke" ? t("revoking") : t("revoke")}
      </button>
      {error ? (
        <span className="ff-error-msg" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
