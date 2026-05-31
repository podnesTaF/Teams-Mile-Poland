"use client";

import { useLocale } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";
import { locales } from "@/lib/i18n/config";

/**
 * Small `.btn .btn-stroke` styled pill in the hero nav. Click cycles
 * locale → next of [pl, en, uk] → back to pl. Keeps the visual to the
 * single-button design while still letting visitors switch languages.
 */
export function LangPill() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const next = locales[(locales.indexOf(locale as (typeof locales)[number]) + 1) % locales.length];

  return (
    <button
      type="button"
      className="btn btn-stroke lang"
      onClick={() => router.replace(pathname, { locale: next })}
      aria-label={`Switch language to ${next.toUpperCase()}`}
    >
      {locale.toUpperCase()}
    </button>
  );
}
