import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import type { Locale } from "@/lib/types";
import type { CommonDictionary } from "@/content/types";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Container } from "./Container";

export function Header({
  locale,
  dict,
}: {
  locale: Locale;
  dict: CommonDictionary;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-brand-border bg-brand-bg/85 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link
          href={`/${locale}`}
          className="flex items-center gap-2 shrink-0"
          aria-label={dict.siteName}
        >
          {/* Logo hostowane na głównej domenie — patrz komentarz w next.config.mjs */}
          <Image
            src="https://poland.acebattle.run/brand/ace-battle-poland.svg"
            alt="ACE BATTLE POLAND"
            width={140}
            height={28}
            priority
            style={{ height: 24, width: "auto" }}
          />
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-semibold uppercase tracking-wide text-brand-textMuted sm:flex">
          <a
            href="https://poland.acebattle.run"
            className="transition-colors hover:text-brand-text"
          >
            {dict.nav.home}
          </a>
          <Link
            href={`/${locale}/register`}
            className="text-brand-accent transition-colors hover:text-brand-accentHover"
          >
            {dict.nav.register}
          </Link>
          <Link
            href={`/${locale}`}
            className="transition-colors hover:text-brand-text"
          >
            {dict.nav.documents}
          </Link>
          <a
            href={`https://poland.acebattle.run/${locale}/terms`}
            className="transition-colors hover:text-brand-text"
          >
            {dict.nav.terms}
          </a>
        </nav>

        <Suspense fallback={<div className="h-8 w-32" aria-hidden />}>
          <LanguageSwitcher current={locale} />
        </Suspense>
      </Container>
    </header>
  );
}
