"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth/auth-client";

export function ResetPasswordForm({ token, invalid }: { token?: string; invalid?: boolean }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (invalid || !token) {
    return (
      <div className="auth-card">
        <div className="banner banner--red">{t("reset.invalid")}</div>
        <p className="auth-foot">
          <Link href="/auth/forgot-password" className="link">
            {t("reset.requestNew")}
          </Link>
        </p>
      </div>
    );
  }

  const ready = password.length >= 8 && confirm.length >= 8;

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || pending) return;
    setError(null);
    if (password !== confirm) {
      setError(t("errors.passwordMismatch"));
      return;
    }
    startTransition(async () => {
      const { error: err } = await authClient.resetPassword({ newPassword: password, token });
      if (err) {
        setError(err.message ?? t("errors.generic"));
        return;
      }
      router.push("/auth/sign-in?reset=1");
    });
  }

  return (
    <div className="auth-card">
      <div className="auth-head">
        <h2 className="auth-title">{t("reset.title")}</h2>
        <p className="auth-sub">{t("reset.subtitle")}</p>
      </div>
      <form className="auth-form" onSubmit={onSubmit}>
        {error ? <div className="banner banner--red">{error}</div> : null}
        <div>
          <label className="flabel">{t("fields.newPassword")}</label>
          <div className="pw-wrap">
            <input
              className="finput"
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("signUp.passwordHint")}
            />
            <button type="button" className="pw-toggle" onClick={() => setShowPw((s) => !s)}>
              {showPw ? t("hide") : t("show")}
            </button>
          </div>
        </div>
        <div>
          <label className="flabel">{t("fields.confirmPassword")}</label>
          <input
            className="finput"
            type={showPw ? "text" : "password"}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-red btn-full" disabled={!ready || pending}>
          {pending ? t("reset.submitting") : t("reset.submit")}
        </button>
      </form>
    </div>
  );
}
