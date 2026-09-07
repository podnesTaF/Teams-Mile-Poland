import type { Locale } from "@/lib/types";

export const LOCALE_META: Record<
  Locale,
  { label: string; short: string; htmlLang: string }
> = {
  pl: { label: "Polski", short: "PL", htmlLang: "pl" },
  en: { label: "English", short: "EN", htmlLang: "en" },
  ua: { label: "Українська", short: "UA", htmlLang: "uk" },
  ru: { label: "Русский", short: "RU", htmlLang: "ru" },
};
