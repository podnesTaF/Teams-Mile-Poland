"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth/auth-client";

import { GoogleButton } from "./google-button";

export function SignInForm({
  redirectTo = "/profile",
  oauthError = false,
}: {
  redirectTo?: string;
  /** An OAuth callback failed and bounced back here with `?error=` (see GoogleButton). */
  oauthError?: boolean;
}) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(
    oauthError ? t("errors.oauthCallback") : null,
  );
  const [needsVerify, setNeedsVerify] = useState(false);
  const [pending, startTransition] = useTransition();

  const ready = email.trim() && password.length > 0;

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || pending) return;
    setError(null);
    setNeedsVerify(false);
    startTransition(async () => {
      const { error: err } = await authClient.signIn.email({
        email: email.trim().toLowerCase(),
        password,
        rememberMe: remember,
        callbackURL: redirectTo,
      });
      if (err) {
        // Branch on the code, not the status: Better Auth answers 403 for both
        // EMAIL_NOT_VERIFIED and INVALID_ORIGIN (a BETTER_AUTH_URL that does
        // not match the host being browsed). Telling someone to verify an
        // already-verified email sends them after the wrong problem.
        if (err.code === "EMAIL_NOT_VERIFIED") {
          setNeedsVerify(true);
          setError(t("errors.notVerified"));
        } else if (err.code === "INVALID_EMAIL_OR_PASSWORD") {
          setError(t("errors.badCredentials"));
        } else {
          console.error("[auth] sign-in failed:", err);
          setError(t("errors.generic"));
        }
        return;
      }
      router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <div className="auth-card">
      <div className="auth-head">
        <h2 className="auth-title">{t("signIn.title")}</h2>
        <p className="auth-sub">{t("signIn.subtitle")}</p>
      </div>

      <GoogleButton callbackURL={redirectTo} />
      <div className="auth-alt">{t("or")}</div>

      <form className="auth-form" onSubmit={onSubmit}>
        {error ? <div className="banner banner--red">{error}</div> : null}
        {needsVerify ? (
          <p className="auth-sub" style={{ textAlign: "left" }}>
            <Link
              href={`/auth/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`}
              className="link"
            >
              {t("verify.resend")}
            </Link>
          </p>
        ) : null}
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
        <div>
          <label className="flabel">{t("fields.password")}</label>
          <div className="pw-wrap">
            <input
              className="finput"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" className="pw-toggle" onClick={() => setShowPw((s) => !s)}>
              {showPw ? t("hide") : t("show")}
            </button>
          </div>
        </div>
        <div className="auth-row">
          <label className="auth-check" style={{ fontSize: ".85rem" }}>
            <input
              type="checkbox"
              style={{ width: 18, height: 18 }}
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>{t("signIn.remember")}</span>
          </label>
          <Link href="/auth/forgot-password" className="link">
            {t("signIn.forgot")}
          </Link>
        </div>
        <button type="submit" className="btn btn-red btn-full" disabled={!ready || pending}>
          {pending ? t("signIn.submitting") : t("signIn.submit")}
        </button>
      </form>

      {/*
        Guests who registered through an event form never chose a password —
        `registerAsGuest` signs them up with a random one — so email sign-in can
        never work for them. The ticket email carries a set-password link; this
        is the same escape hatch for anyone who no longer has that email.
      */}
      <p className="auth-foot">
        {t("signIn.noPasswordYet")}{" "}
        <Link href="/auth/forgot-password" className="link">
          {t("signIn.setPassword")}
        </Link>
      </p>

      <p className="auth-foot">
        {t("signIn.noAccount")}{" "}
        <Link href={`/auth/sign-up?redirectTo=${encodeURIComponent(redirectTo)}`} className="link">
          {t("signUp.submit")}
        </Link>
      </p>
    </div>
  );
}
