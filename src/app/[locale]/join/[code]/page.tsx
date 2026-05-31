import { setRequestLocale } from "next-intl/server";

import { LandingView } from "@/components/landing/landing-view";
import { JoinModal } from "@/features/registration/components/join-modal";
import { normalizeTeamCode } from "@/features/registration/schemas";

/**
 * Real invite route. Captains share `/join/CODE`; on a hard load the landing
 * renders behind the join modal (same as the intercepted soft-nav view).
 */
export default async function JoinCodePage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  return (
    <>
      <LandingView />
      <JoinModal code={normalizeTeamCode(decodeURIComponent(code))} />
    </>
  );
}
