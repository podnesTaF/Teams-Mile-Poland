"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth/auth-client";

const RESEND_SECONDS = 30;

export function VerifyEmailView({ email }: { email?: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timer.current = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1 && timer.current) clearInterval(timer.current);
        return n - 1;
      });
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  function resend() {
    if (!email || pending || countdown > 0) return;
    setError(null);
    startTransition(async () => {
      const { error: err } = await authClient.sendVerificationEmail({
        email,
        callbackURL: "/profile",
      });
      if (err) {
        setError(err.message ?? t("errors.generic"));
        return;
      }
      setResent(true);
      setCountdown(RESEND_SECONDS);
      timer.current = setInterval(() => {
        setCountdown((n) => {
          if (n <= 1 && timer.current) clearInterval(timer.current);
          return n - 1;
        });
      }, 1000);
    });
  }

  return (
    <div className="auth-card" style={{ textAlign: "center" }}>
      <div className="state-icon state-icon--mail">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      </div>
      <div className="auth-head" style={{ marginBottom: 20 }}>
        <h2 className="auth-title">{t("verify.title")}</h2>
        <p className="auth-sub">{t("verify.sentTo")}</p>
        {email ? <span className="email-pill">{email}</span> : null}
        <p className="auth-sub" style={{ marginTop: 12 }}>
          {t("verify.body")}
        </p>
      </div>

      {error ? <div className="banner banner--red" style={{ marginBottom: 14 }}>{error}</div> : null}
      {resent ? <div className="banner banner--ok" style={{ marginBottom: 14 }}>{t("verify.resent")}</div> : null}

      <button
        type="button"
        className="btn btn-red btn-full"
        onClick={() => {
          router.push("/profile");
          router.refresh();
        }}
      >
        {t("verify.confirmed")}
      </button>

      {email ? (
        <div style={{ marginTop: 18 }}>
          <button
            type="button"
            className="btn btn-stroke-dark btn-full btn-sm"
            onClick={resend}
            disabled={pending || countdown > 0}
          >
            {pending ? t("verify.resending") : t("verify.resend")}
          </button>
          {countdown > 0 ? (
            <p className="resend-note">
              {t("verify.resendIn")} <span className="countdown">{countdown}s</span>
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="auth-foot">
        <Link href="/auth/sign-up" className="link">
          {t("verify.wrongAddress")}
        </Link>{" "}
        ·{" "}
        <Link href="/auth/sign-in" className="link">
          {t("signIn.submit")}
        </Link>
      </p>
    </div>
  );
}
