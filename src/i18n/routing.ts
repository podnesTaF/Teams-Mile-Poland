import { defineRouting } from "next-intl/routing";
import { locales, defaultLocale } from "@/lib/i18n/config";

export const routing = defineRouting({
  locales: [...locales],
  defaultLocale,
  localePrefix: "as-needed",
});
