export const locales = ["pl", "en", "ua"] as const;
export const defaultLocale = "pl" as const;
export type Locale = (typeof locales)[number];
