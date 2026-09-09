"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { inviteByEmail } from "../actions/invitations";

/**
 * "Invite a runner by email" — the captain's door (PRD #57, client island
 * `InviteForm`: `{ email, pending, notice }`).
 *
 * Plain `useState` + the house dark form vocabulary, the same skin as
 * `TeamForm`. Refusals arrive as `TeamActionReason` keys and are rendered from
 * `teams.reasons`, so `already_member` and `roster_full` read as sentences the
 * captain can act on rather than as a generic error.
 *
 * The address is validated only once the field has been left or submit was
 * pressed — an empty form must not open red.
 */
export function InviteForm({ slug, disabled }: { slug: string; disabled?: boolean }) {
  const t = useTranslations("teams.invitations");
  const tReasons = useTranslations("teams.reasons");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ready = /.+@.+\..+/.test(email.trim());
  const showInvalid = touched && email.trim().length > 0 && !ready;

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || disabled) return;
    if (!ready) {
      setTouched(true);
      return;
    }
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
      setTouched(false);
      router.refresh();
    });
  }

  return (
    <form
      className="profile-form team-form invite-form"
      onSubmit={onSubmit}
      data-invite-form={slug}
      noValidate
    >
      {error ? (
        <div className="banner banner--red" role="alert">
          <div className="banner__body">
            <div className="banner__txt">{error}</div>
          </div>
        </div>
      ) : null}
      {notice ? (
        <div className="banner banner--ok" role="status">
          <div className="banner__body">
            <div className="banner__txt">{notice}</div>
          </div>
        </div>
      ) : null}

      <div className="invite-form__row">
        <label className="block invite-form__field">
          <span className="flabel on-dark">{t("emailLabel")}</span>
          <input
            className={cn("finput on-dark", showInvalid && "finput--err")}
            type="email"
            inputMode="email"
            autoComplete="off"
            maxLength={200}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onBlur={() => setTouched(true)}
            disabled={disabled}
            aria-invalid={showInvalid ? true : undefined}
          />
          {showInvalid ? (
            <span className="field-msg">{t("emailInvalid")}</span>
          ) : (
            <span className="fhint">{t("emailHint")}</span>
          )}
        </label>
        <button type="submit" className="btn btn-red invite-form__submit" disabled={pending || disabled}>
          {pending ? t("sending") : t("send")}
        </button>
      </div>
    </form>
  );
}
