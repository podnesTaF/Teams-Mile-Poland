"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth/auth-client";

import { GoogleButton } from "./google-button";

/** Split a full name into first / rest for the profile additionalFields. */
function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

export function SignUpForm({ locale }: { locale: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ready = name.trim() && email.trim() && password.length >= 8 && terms;

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || pending) return;
    setError(null);
    const { firstName, lastName } = splitName(name);
    startTransition(async () => {
      const { error: err } = await authClient.signUp.email({
        email: email.trim().toLowerCase(),
        password,
        name: name.trim(),
        firstName,
        lastName,
        locale,
        callbackURL: "/profile",
      });
      if (err) {
        setError(err.message ?? t("errors.generic"));
        return;
      }
      router.push(`/auth/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    });
  }

  return (
    <div className="auth-card">
      <div className="auth-head">
        <h2 className="auth-title">{t("signUp.title")}</h2>
        <p className="auth-sub">{t("signUp.subtitle")}</p>
      </div>

      <GoogleButton />
      <div className="auth-alt">{t("or")}</div>

      <form className="auth-form" onSubmit={onSubmit}>
        {error ? <div className="banner banner--red">{error}</div> : null}
        <div>
          <label className="flabel">{t("fields.fullName")}</label>
          <input
            className="finput"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jan Kowalski"
          />
        </div>
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
        <label className="auth-check">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
          <span>
            {t.rich("signUp.terms", {
              link: (chunks) => (
                <Link href="/terms" target="_blank" rel="noopener noreferrer">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </label>
        <button type="submit" className="btn btn-red btn-full" disabled={!ready || pending}>
          {pending ? t("signUp.submitting") : t("signUp.submit")}
        </button>
      </form>

      <p className="auth-foot">
        {t("signUp.haveAccount")}{" "}
        <Link href="/auth/sign-in" className="link">
          {t("signIn.submit")}
        </Link>
      </p>
    </div>
  );
}
