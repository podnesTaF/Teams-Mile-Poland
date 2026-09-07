"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LOCALES, type Locale } from "@/lib/types";
import { LOCALE_META } from "@/content/locales-meta";

/**
 * Przełącznik języka: podmienia wyłącznie pierwszy segment ścieżki
 * ( /pl/documents/oswiadczenie -> /en/documents/oswiadczenie ),
 * zachowując resztę ścieżki i query string (np. ?event=mile-2026-08-29),
 * tak aby wybrane wydarzenie i dokument nie „gubiły się" przy zmianie języka.
 */
export function LanguageSwitcher({ current }: { current: Locale }) {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  const segments = pathname.split("/").filter(Boolean);
  segments.shift(); // usuń bieżący segment językowy

  return (
    <nav
      aria-label="Language switcher"
      className="flex items-center gap-1 rounded-pill border border-brand-border bg-white/5 p-1"
    >
      {LOCALES.map((loc) => {
        const href =
          "/" + [loc, ...segments].join("/") + (query ? `?${query}` : "");
        const active = loc === current;
        return (
          <Link
            key={loc}
            href={href}
            aria-current={active ? "true" : undefined}
            className={`rounded-pill px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
              active
                ? "bg-brand-gradient text-brand-bg"
                : "text-brand-textMuted hover:text-brand-text"
            }`}
          >
            {LOCALE_META[loc].short}
          </Link>
        );
      })}
    </nav>
  );
}
