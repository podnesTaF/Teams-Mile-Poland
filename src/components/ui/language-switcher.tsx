"use client";

import { useLocale, useTranslations } from "next-intl";

import { syncUserLocale } from "@/features/profile/actions";
import { usePathname, useRouter } from "@/i18n/navigation";

const LOCALES = ["en", "pl", "ua"] as const;

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("common");

  return (
    <label className="inline-flex h-9 flex-shrink-0 items-center border border-line bg-bg-2 px-1.5 font-mono text-[10px] uppercase tracking-[0.04em] text-ink sm:px-2 sm:text-[11px] sm:tracking-[0.08em]">
      <span className="sr-only">{t("language")}</span>
      <select
        value={locale}
        aria-label={t("language")}
        onChange={(event) => {
          const nextLocale = event.target.value;
          router.replace(pathname, { locale: nextLocale });
          // Keep the account's email language in step with the site language.
          void syncUserLocale(nextLocale);
        }}
        className="h-full max-w-[44px] bg-transparent text-[10px] uppercase outline-none sm:max-w-[52px] sm:text-[11px]"
      >
        {LOCALES.map((item) => (
          <option key={item} value={item}>
            {item.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}
