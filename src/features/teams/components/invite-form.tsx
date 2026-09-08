"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { FloatField } from "@/components/ui/float-field";
import { useRouter } from "@/i18n/navigation";

import { inviteByEmail } from "../actions/invitations";

/**
 * "Invite a runner by email" — the manager's door (PRD #57, client island
 * `InviteForm`: `{ email, pending, notice }`).
 *
 * Plain `useState` + `FloatField`, the house form vocabulary. Refusals arrive
 * as `TeamActionReason` keys and are rendered from `teams.reasons`, so
 * `already_member` and `roster_full` read as sentences the manager can act on
 * rather than as a generic error.
 */
export function InviteForm({ slug, disabled }: { slug: string; disabled?: boolean }) {
  const t = useTranslations("teams.invitations");
  const tReasons = useTranslations("teams.reasons");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ready = /.+@.+\..+/.test(email.trim());

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || pending || disabled) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await inviteByEmail(slug, { email: email.trim() });
      if (!result.ok) {
        setError(tReasons(result.reason));
        return;
      }
      setNotice(t("sent", { email: result.email }));
      setEmail("");
      router.refresh();
    });
  }

  return (
    <form className="iv-card" onSubmit={onSubmit} data-invite-form={slug}>
      {error ? (
        <div className="banner banner--red" role="alert">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="banner banner--ok" role="status">
          {notice}
        </div>
      ) : null}

      <FloatField
        label={t("emailLabel")}
        type="email"
        autoComplete="off"
        maxLength={200}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        hint={t("emailHint")}
        disabled={disabled}
      />

      <div className="iv-actions">
        <button
          type="submit"
          className="btn btn-red btn-sm"
          disabled={!ready || pending || disabled}
        >
          {pending ? t("sending") : t("send")}
        </button>
      </div>
    </form>
  );
}
