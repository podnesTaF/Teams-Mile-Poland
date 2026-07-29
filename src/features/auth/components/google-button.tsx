"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { authClient } from "@/lib/auth/auth-client";

import { GoogleIcon } from "./auth-shell";

/**
 * Google OAuth sign-in, styled per the mockup (.btn-google).
 *
 * On success the browser leaves for Google, so `pending` only ever clears on
 * failure — and failures are shown rather than swallowed. A missing
 * `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` or a `BETTER_AUTH_URL` that does
 * not match the host being browsed both fail right here, and a button that
 * silently does nothing is indistinguishable from a dead one. The provider's
 * own message is logged, not rendered: it is untranslated and usually says
 * nothing a runner can act on.
 */
export function GoogleButton({ callbackURL = "/profile" }: { callbackURL?: string }) {
  const t = useTranslations("auth");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setPending(true);
    setError(null);
    try {
      const { error: err } = await authClient.signIn.social({ provider: "google", callbackURL });
      if (err) {
        console.error("[auth] Google sign-in failed:", err);
        setError(t("errors.googleUnavailable"));
      }
    } catch (err) {
      console.error("[auth] Google sign-in threw:", err);
      setError(t("errors.googleUnavailable"));
    }
    setPending(false);
  }

  return (
    <>
      {error ? <div className="banner banner--red">{error}</div> : null}
      <button type="button" className="btn-google" onClick={onClick} disabled={pending}>
        <GoogleIcon />
        {t("google")}
      </button>
    </>
  );
}
