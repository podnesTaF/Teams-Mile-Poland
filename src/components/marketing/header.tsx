import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";

import { Container } from "@/components/ui/container";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { Link } from "@/i18n/navigation";
import { EVENT } from "@/lib/marketing/event";

import { SlotBadge } from "./slot-badge";

const NAV_LINKS = ["sport", "schedule", "venue", "documents", "faq"] as const;

type HeaderProps = {
  remaining?: number;
  total?: number;
};

export async function Header({
  remaining = EVENT.freeTier.total,
  total = EVENT.freeTier.total,
}: HeaderProps) {
  const t = await getTranslations("header");
  const common = await getTranslations("common");
  const locale = await getLocale();
  const dateLabel = locale === "pl" ? EVENT.dateLabel.pl : EVENT.dateLabel.en;

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg">
      <Container className="flex h-[68px] min-w-0 items-center justify-between gap-2 px-3 sm:px-4 md:px-6 lg:gap-4">
        <Link href="/" className="flex min-w-0 flex-shrink-0 items-center gap-2 lg:gap-3">
          <Image
            src="/brand/logo.svg"
            alt="TEAMS MILE"
            className="h-4 w-auto lg:h-6"
            width={22}
            height={150}
          />
          <span className="hidden max-w-[120px] border-l border-line pl-2 font-mono text-[9px] uppercase leading-tight tracking-[0.1em] text-muted sm:inline-block lg:max-w-none lg:pl-3 lg:text-[10px] lg:tracking-[0.14em]">
            {t("city")}
            <br />
            {dateLabel}
          </span>
        </Link>

        <nav className="hidden min-w-0 flex-1 justify-center gap-3 xl:flex xl:gap-5">
          {NAV_LINKS.map((link) => (
            <Link
              key={link}
              href={`/#${link}`}
              className="whitespace-nowrap font-display-alt text-[11px] font-medium uppercase tracking-[0.05em] text-ink transition-colors hover:text-accent 2xl:text-[13px] 2xl:tracking-[0.08em]"
            >
              {t(`nav.${link}`)}
            </Link>
          ))}
        </nav>

        <div className="flex min-w-0 flex-shrink-0 items-center gap-1.5 sm:gap-2">
          <SlotBadge remaining={remaining} total={total} />
          <LanguageSwitcher />
          <Link
            href="/register"
            className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap bg-accent px-2.5 font-display-alt text-[10px] font-semibold uppercase tracking-[0.05em] text-white transition-colors hover:bg-[#b8302a] active:translate-y-px sm:px-3 md:text-[11px] xl:px-3.5 xl:text-[11.5px] xl:tracking-[0.08em]"
          >
            {common("register")}
          </Link>
        </div>
      </Container>
    </header>
  );
}
