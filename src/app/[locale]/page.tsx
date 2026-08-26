import { setRequestLocale } from "next-intl/server";

import "../landing.css";

import { LandingView } from "@/components/landing/landing-view";

/**
 * Safety-net ISR: admin actions revalidate this page on demand
 * (`revalidateEventSurfaces`, news/media actions), but a write that bypasses
 * the app — a manual DB correction, a seed — reaches no `revalidatePath` and
 * used to leave the landing stale until the next deploy (the 08-22 night sat
 * hidden here for days after its status row was fixed by hand). Five minutes
 * bounds that staleness; on-demand invalidation still makes admin edits
 * instant. Must stay a literal — the value is statically analyzed.
 */
export const revalidate = 300;

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LandingView />;
}
