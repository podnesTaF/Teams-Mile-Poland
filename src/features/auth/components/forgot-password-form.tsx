"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth/auth-client";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || pending) return;
    setError(null);
    startTransition(async () => {
      const { error: err } = await authClient.requestPasswordReset({
        email: email.trim().toLowerCase(),
        redirectTo: "/auth/reset-password",
      });
      if (err) {
        setError(err.message ?? t("errors.generic"));
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="auth-card" style={{ textAlign: "center" }}>
        <div className="state-icon state-icon--mail">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
        </div>
        <div className="auth-head" style={{ marginBottom: 20 }}>
          <h2 className="auth-title">{t("forgot.sentTitle")}</h2>
          <p className="auth-sub">{t("forgot.sentIntro")}</p>
          <span className="email-pill">{email.trim().toLowerCase()}</span>
          <p className="auth-sub" style={{ marginTop: 12 }}>
            {t("forgot.sentBody")}
          </p>
        </div>
        <p className="auth-foot">
          <Link href="/auth/sign-in" className="link">
            {t("backToSignIn")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <div className="auth-head">
        <h2 className="auth-title">{t("forgot.title")}</h2>
        <p className="auth-sub">{t("forgot.subtitle")}</p>
      </div>
      <form className="auth-form" onSubmit={onSubmit}>
        {error ? <div className="banner banner--red">{error}</div> : null}
        <div>
          <label className="flabel">{t("fields.email")}</label>
          <input
            className="finput"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
          />
        </div>
        <button type="submit" className="btn btn-red btn-full" disabled={!email.trim() || pending}>
          {pending ? t("forgot.submitting") : t("forgot.submit")}
        </button>
      </form>
      <p className="auth-foot">
        <Link href="/auth/sign-in" className="link">
          {t("backToSignIn")}
        </Link>
      </p>
    </div>
  );
}
