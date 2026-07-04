"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { authClient } from "@/lib/auth/auth-client";

import { GoogleIcon } from "./auth-shell";

/** Google OAuth sign-in, styled per the mockup (.btn-google). */
export function GoogleButton({ callbackURL = "/profile" }: { callbackURL?: string }) {
  const t = useTranslations("auth");
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    await authClient.signIn.social({ provider: "google", callbackURL });
    setPending(false);
  }

  return (
    <button type="button" className="btn-google" onClick={onClick} disabled={pending}>
      <GoogleIcon />
      {t("google")}
    </button>
  );
}
