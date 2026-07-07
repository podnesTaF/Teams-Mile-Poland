import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { EventRegisterContent } from "@/features/event-registration/components/event-register-content";
import { RegisterModal } from "@/features/event-registration/components/register-modal";

/**
 * Intercepts soft navigations to `/events/[slug]/register` and renders the
 * shared register content inside the modal shell over the event page. The real
 * page at `[locale]/events/[slug]/register` serves hard loads / refreshes.
 */
export default async function InterceptedEventRegister({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return (
    <RegisterModal>
      <EventRegisterContent slug={slug} locale={locale} />
    </RegisterModal>
  );
}
