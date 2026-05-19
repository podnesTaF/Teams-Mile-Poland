"use client";

import { useLiveCounters } from "@/features/registration/use-live-counters";
import type { RegistrationCounters } from "@/features/registration/data";
import { EVENT, formatN, getUrgency } from "@/lib/marketing/event";
import { cn } from "@/lib/utils";

const URGENCY_COPY = {
  ok: {
    tag: "Free tier open",
    line: "First-come, first-served. No payment required.",
  },
  amber: {
    tag: "Filling up",
    line: "Half the free slots are gone — secure yours.",
  },
  red: {
    tag: "Almost gone",
    line: "Less than 20% of free slots left.",
  },
  gone: {
    tag: "Free tier closed",
    line: `All flows continue at ${EVENT.freeTier.pricePln} PLN per runner.`,
  },
} as const;

const fillColor = {
  ok: "bg-success",
  amber: "bg-warning",
  red: "bg-accent",
  gone: "bg-muted-2",
} as const;

const bannerStyle = {
  ok: "bg-bg-2 text-ink",
  amber: "bg-[#fcecd1] text-warning",
  red: "bg-accent text-white",
  gone: "bg-bg-3 text-muted",
} as const;

type ScarcityPanelProps = {
  remaining?: number;
  total?: number;
  teamsFormed?: number;
};

export function ScarcityPanel({
  remaining = EVENT.freeTier.total,
  total = EVENT.freeTier.total,
  teamsFormed = 0,
}: ScarcityPanelProps) {
  const initial: RegistrationCounters = {
    freeSlotsRemaining: remaining,
    freeSlotsTotal: total,
    freeSlotsClaimed: Math.max(total - remaining, 0),
    teamsFormed,
  };
  const live = useLiveCounters(initial);

  const liveRemaining = live.freeSlotsRemaining;
  const liveTotal = live.freeSlotsTotal;
  const urgency = getUrgency(liveRemaining, liveTotal);
  const pct = Math.max(0, Math.min(100, (liveRemaining / liveTotal) * 100));
  const { tag, line } = URGENCY_COPY[urgency];

  return (
    <div className="flex flex-col gap-3.5 border border-ink bg-bg p-5">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="eyebrow eyebrow-ink mb-1.5 flex items-center gap-1.5">
            <span aria-hidden>♠</span>
            <span>Free slots left</span>
          </div>
          <div className="flex items-baseline gap-2 font-display text-[clamp(36px,5vw,52px)] font-black italic leading-[0.9] tracking-tight">
            <span className="text-ink">{formatN(liveRemaining)}</span>
            <span className="font-display-alt text-[0.32em] font-semibold uppercase tracking-[0.12em] text-muted">
              remaining
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="eyebrow mb-1.5">Teams forming</div>
          <div className="font-display text-[clamp(20px,2.6vw,28px)] font-black italic leading-[0.9] text-ink">
            {live.teamsFormed}
          </div>
        </div>
      </div>

      <div
        className="relative h-2 overflow-hidden bg-bg-3"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Free slots remaining"
      >
        <div
          className={cn(
            "h-full transition-all duration-500 ease-snappy",
            fillColor[urgency],
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
        <span aria-hidden>·</span>
        <span>{tag}</span>
        <span aria-hidden>·</span>
      </div>

      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2.5 text-sm",
          bannerStyle[urgency],
        )}
      >
        <strong className="font-display-alt text-xs font-semibold uppercase tracking-[0.08em]">
          {tag}.
        </strong>
        <span>{line}</span>
      </div>
    </div>
  );
}
