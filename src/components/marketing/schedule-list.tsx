import { useTranslations } from "next-intl";

import { SCHEDULE } from "@/lib/marketing/event";
import { cn } from "@/lib/utils";

export function ScheduleList() {
  const t = useTranslations("schedule");

  return (
    <div className="border border-ink bg-bg p-9">
      <ol className="m-0 grid list-none grid-cols-1 gap-0 p-0">
        {SCHEDULE.map((row) => (
          <li
            key={row.time}
            className="grid grid-cols-[100px_16px_1fr] items-center gap-4 border-b border-line py-5 last:border-b-0 md:grid-cols-[140px_24px_1fr_auto] md:gap-[18px]"
          >
            <span className="font-mono text-[13px] font-medium tracking-[0.04em]">
              {row.time}
            </span>
            <span
              aria-hidden
              className={cn(
                "mx-auto h-3 w-3",
                row.key ? "bg-accent" : "bg-line-2",
              )}
            />
            <span className="font-display text-lg font-black italic uppercase tracking-tight md:text-[22px]">
              {t(row.name)}
            </span>
            <span className="hidden font-mono text-[11px] uppercase tracking-[0.06em] text-muted md:inline">
              {t(row.meta)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
