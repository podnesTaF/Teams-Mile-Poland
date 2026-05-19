"use client";

import { useLiveCounters } from "@/features/registration/use-live-counters";
import type { RegistrationCounters } from "@/features/registration/data";
import { EVENT, formatN, getUrgency } from "@/lib/marketing/event";
import { cn } from "@/lib/utils";

const urgencyDotClass = {
  ok: "bg-success animate-pulse-slow",
  amber: "bg-warning animate-pulse-slow",
  red: "bg-accent animate-pulse-slow",
  gone: "bg-muted-2",
} as const;

type SlotBadgeProps = {
  remaining?: number;
  total?: number;
};

export function SlotBadge({
  remaining = EVENT.freeTier.total,
  total = EVENT.freeTier.total,
}: SlotBadgeProps) {
  const initial: RegistrationCounters = {
    freeSlotsRemaining: remaining,
    freeSlotsTotal: total,
    freeSlotsClaimed: Math.max(total - remaining, 0),
    teamsFormed: 0,
  };
  const live = useLiveCounters(initial);
  const liveRemaining = live.freeSlotsRemaining;
  const urgency = getUrgency(liveRemaining, live.freeSlotsTotal);

  const label =
    urgency === "gone"
      ? `Free tier sold out · ${EVENT.freeTier.pricePln} PLN/runner`
      : `${formatN(liveRemaining)} free slots left`;

  return (
    <div className="hidden h-8 items-center gap-2 border border-line bg-bg-2 px-3 font-mono text-[11px] tracking-wide md:inline-flex">
      <span
        className={cn(
          "h-[7px] w-[7px] rounded-full",
          urgencyDotClass[urgency],
        )}
      />
      <span>{label}</span>
    </div>
  );
}
