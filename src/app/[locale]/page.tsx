import { setRequestLocale } from "next-intl/server";

import "../landing.css";

import { LandingView } from "@/components/landing/landing-view";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LandingView />;
}
