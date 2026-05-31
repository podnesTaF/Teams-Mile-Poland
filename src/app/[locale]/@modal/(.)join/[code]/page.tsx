import { setRequestLocale } from "next-intl/server";

import { JoinModal } from "@/features/registration/components/join-modal";
import { normalizeTeamCode } from "@/features/registration/schemas";

/**
 * Intercepts soft navigations to `/join/CODE` and renders the join modal
 * over the landing. The real page at `[locale]/join/[code]` serves hard loads.
 */
export default async function InterceptedJoin({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  return <JoinModal code={normalizeTeamCode(decodeURIComponent(code))} />;
}
