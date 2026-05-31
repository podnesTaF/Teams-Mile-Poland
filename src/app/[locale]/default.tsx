import { setRequestLocale } from "next-intl/server";

import "./../landing.css";

import { LandingView } from "@/components/landing/landing-view";

/**
 * Fallback for the implicit `children` slot. Required by Next.js when using
 * the `@modal` parallel slot: during the parallel render for an intercepted
 * modal route (e.g. soft-navigating `/` → `/register`), the router may be
 * unable to recover the active `children` state. Without this file it would
 * render nothing behind the modal — leaving the backdrop with no page behind
 * it. Rendering the landing here keeps it visible through the modal.
 */
export default async function LocaleDefault({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LandingView />;
}
