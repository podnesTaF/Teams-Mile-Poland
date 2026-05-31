import { getAppUrl } from "@/features/registration/data";
import { defaultLocale } from "@/lib/i18n/config";

import { signTicket } from "./sign";

type TicketUrlOptions = {
  locale?: string;
};

export function makeTicketUrl(runnerId: string, options: TicketUrlOptions = {}): string {
  const locale = options.locale ?? defaultLocale;
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  const sig = signTicket(runnerId);
  return `${getAppUrl()}${prefix}/ticket/${encodeURIComponent(runnerId)}?s=${encodeURIComponent(sig)}`;
}
