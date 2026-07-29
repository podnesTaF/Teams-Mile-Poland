export const locales = ["pl", "en", "ua"] as const;
export const defaultLocale = "pl" as const;
export type Locale = (typeof locales)[number];

/**
 * A public path under a locale — the default locale carries no prefix.
 *
 * For server actions building their own redirect/revalidate targets, where the
 * `Link` / `redirect` helpers from `@/i18n/navigation` are not in play. The
 * admin equivalent is `adminPath` in `features/admin/action-helpers.ts`.
 */
export function localePath(locale: string, path: string): string {
  return locale === defaultLocale ? path : `/${locale}${path}`;
}
