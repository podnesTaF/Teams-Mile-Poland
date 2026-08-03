"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth/auth-client";

/**
 * The profile page's security card — change the sign-in password while
 * signed in, via Better Auth's `changePassword` (current password required,
 * other sessions revoked). Guests who registered passwordless (ADR-0002) and
 * OAuth-only accounts don't know a current password — the footer link routes
 * them to the emailed reset flow instead.
 */
export function ChangePasswordForm() {
  const t = useTranslations("profile.security");
  const tAuth = useTranslations("auth");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const ready = current.length > 0 && next.length >= 8 && confirm.length >= 8;

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || pending) return;
    setError(null);
    setSaved(false);
    if (next !== confirm) {
      setError(tAuth("errors.passwordMismatch"));
      return;
    }
    startTransition(async () => {
      const { error: err } = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });
      if (err) {
        setError(err.code === "INVALID_PASSWORD" ? t("wrongCurrent") : err.message ?? tAuth("errors.generic"));
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      setSaved(true);
    });
  }

  return (
    <form onSubmit={onSubmit} className="profile-form">
      {error ? <div className="banner banner--red">{error}</div> : null}
      {saved ? <div className="banner banner--ok">{t("saved")}</div> : null}

      <div className="form-section">
        <div className="form-section__h">{t("title")}</div>
        <p className="form-section__sub">{t("sub")}</p>
        <div className="fgrid">
          <label className="block">
            <span className="flabel on-dark">{t("current")}</span>
            <input
              className="finput on-dark"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="flabel on-dark">{tAuth("fields.newPassword")}</span>
            <div className="pw-wrap">
              <input
                className="finput on-dark"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder={tAuth("signUp.passwordHint")}
                required
              />
              <button type="button" className="pw-toggle" onClick={() => setShowPw((s) => !s)}>
                {showPw ? tAuth("hide") : tAuth("show")}
              </button>
            </div>
          </label>
          <label className="block">
            <span className="flabel on-dark">{tAuth("fields.confirmPassword")}</span>
            <input
              className="finput on-dark"
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </label>
        </div>
      </div>

      <div className="form-actions">
        <span className="form-actions__note">
          {t("forgot")}{" "}
          <Link href="/auth/forgot-password" className="link">
            {t("forgotCta")}
          </Link>
        </span>
        <button type="submit" className="btn btn-red" disabled={!ready || pending}>
          {pending ? t("submitting") : t("submit")}
        </button>
      </div>
    </form>
  );
}
