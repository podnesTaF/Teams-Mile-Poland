import { setRequestLocale } from "next-intl/server";

import { LandingView } from "@/components/landing/landing-view";
import { RegistrationFlow } from "@/features/registration/components/registration-flow";

/**
 * Real registration route (direct load / refresh / shared link). Renders the
 * landing underneath the modal so a cold deep-link still shows the page
 * behind the translucent backdrop — matching the soft-navigation experience
 * (where the intercepting `@modal` slot overlays the kept-mounted landing).
 */
export default async function RegisterStepPage({
  params,
}: {
  params: Promise<{ locale: string; step?: string[] }>;
}) {
  const { locale, step } = await params;
  setRequestLocale(locale);
  return (
    <>
      <LandingView />
      <RegistrationFlow step={step} />
    </>
  );
}
