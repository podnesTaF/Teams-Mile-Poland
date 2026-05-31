import { setRequestLocale } from "next-intl/server";

import { RegistrationFlow } from "@/features/registration/components/registration-flow";

/**
 * Intercepts soft navigations to `/register[/...]` and renders the modal
 * over the currently-mounted landing page (the @modal parallel slot). The
 * matching real page at `[locale]/register/[[...step]]` serves hard loads.
 */
export default async function InterceptedRegisterStep({
  params,
}: {
  params: Promise<{ locale: string; step?: string[] }>;
}) {
  const { locale, step } = await params;
  setRequestLocale(locale);
  return <RegistrationFlow step={step} />;
}
