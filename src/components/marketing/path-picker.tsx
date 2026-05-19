import { Rank } from "@/components/ui/rank";
import { Link } from "@/i18n/navigation";
import { REGISTRATION_PATHS } from "@/lib/marketing/event";
import { cn } from "@/lib/utils";

const pathHref: Record<string, string> = {
  start: "/register/start",
  join: "/join",
  free: "/register/free",
  solo: "/register/solo",
};

export function PathPicker() {
  return (
    <div className="grid grid-cols-1 border border-ink sm:grid-cols-2 xl:grid-cols-4">
      {REGISTRATION_PATHS.map((card, idx) => {
        const isPrimary = Boolean(card.primary);
        const isLastCol = (idx + 1) % 4 === 0;
        const isLastRowSm = idx >= REGISTRATION_PATHS.length - 2;

        return (
          <Link
            key={card.id}
            href={pathHref[card.id] ?? "#"}
            className={cn(
              "group relative flex min-h-[320px] flex-col gap-[18px] border-b border-ink p-7 text-left transition-colors duration-150",
              "sm:nth-of-type-2n:border-r-0",
              isLastCol && "xl:border-r-0",
              isPrimary
                ? "bg-accent text-white"
                : "bg-bg text-ink hover:bg-ink hover:text-white",
              !isLastRowSm && "sm:border-b",
              "border-r border-ink xl:border-b-0 sm:[&:nth-of-type(2n)]:border-r-0 xl:[&:nth-of-type(2n)]:border-r xl:[&:last-child]:border-r-0",
            )}
          >
            <div className="flex items-center gap-2">
              <Rank
                rank={card.rank}
                intent={isPrimary ? "outlineLight" : "red"}
              />
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
                {card.title}
              </div>
              <p
                className={cn(
                  "mt-2 text-[13.5px] leading-relaxed",
                  isPrimary ? "text-white/85" : "text-muted",
                )}
              >
                {card.desc}
              </p>
            </div>

            <div
              className={cn(
                "mt-auto flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.1em]",
                isPrimary ? "text-white/70" : "text-muted",
              )}
            >
              <span>{card.meta}</span>
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
