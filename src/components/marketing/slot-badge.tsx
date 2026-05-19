"use client";

import { useTranslations } from "next-intl";

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
  const t = useTranslations("slotBadge");
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
      ? t("soldOut", { price: EVENT.freeTier.pricePln })
      : t("left", { remaining: formatN(liveRemaining) });

  return (
    <div className="hidden h-8 max-w-[190px] items-center gap-2 overflow-hidden border border-line bg-bg-2 px-2.5 font-mono text-[10px] tracking-wide lg:inline-flex 2xl:max-w-none 2xl:px-3 2xl:text-[11px]">
      <span
        className={cn(
          "h-[7px] w-[7px] rounded-full",
          urgencyDotClass[urgency],
        )}
      />
      <span className="truncate">{label}</span>
    </div>
  );
}
