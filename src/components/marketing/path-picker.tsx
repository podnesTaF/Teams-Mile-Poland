import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const CARDS = [
  {
    id: "create" as const,
    href: "/register/team",
    primary: true,
    num: "01",
  },
  {
    id: "quick" as const,
    href: "/register/solo",
    primary: false,
    num: "02",
  },
];

/**
 * Landing-page entry to the modal flow. Two cards mirror the chooser
 * modal so the section reads the same whether the visitor opens via
 * the Register button or scrolls to the #register anchor.
 */
export function PathPicker() {
  const t = useTranslations("paths");

  return (
    <div className="grid grid-cols-1 border border-ink sm:grid-cols-2">
      {CARDS.map((card) => {
        const isPrimary = card.primary;
        return (
          <Link
            key={card.id}
            href={card.href}
            className={cn(
              "group relative flex min-h-[320px] flex-col gap-[18px] border-ink p-7 text-left transition-colors duration-150 sm:[&:first-child]:border-r",
              isPrimary
                ? "bg-accent text-white"
                : "bg-bg text-ink hover:bg-ink hover:text-white",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "font-mono text-[11px] uppercase tracking-[0.1em]",
                  isPrimary ? "text-white/70" : "text-muted",
                )}
              >
                {card.num}
              </span>
            </div>

            <div>
              <div className="font-display text-[clamp(26px,2.8vw,34px)] font-black italic uppercase leading-[0.95] tracking-tight">
                {t(`${card.id}.title`)}
              </div>
              <p
                className={cn(
                  "mt-2 text-[13.5px] leading-relaxed",
                  isPrimary ? "text-white/85" : "text-muted",
                )}
              >
                {t(`${card.id}.desc`)}
              </p>
            </div>

            <div
              className={cn(
                "mt-auto flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.1em]",
                isPrimary ? "text-white/70" : "text-muted",
              )}
            >
              <span>{t(`${card.id}.meta`)}</span>
              <span
                aria-hidden
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center text-sm transition-colors",
                  isPrimary
                    ? "bg-ink text-white"
                    : "bg-ink text-white group-hover:bg-accent",
                )}
              >
                →
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
