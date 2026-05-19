"use client";

import { useEffect, useState } from "react";

import type { RegistrationCounters } from "./data";

const DEFAULT_INTERVAL_MS = 20_000;

export function useLiveCounters(
  initial: RegistrationCounters,
  intervalMs: number = DEFAULT_INTERVAL_MS,
): RegistrationCounters {
  const [counters, setCounters] = useState<RegistrationCounters>(initial);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const res = await fetch("/api/counters", { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as RegistrationCounters;
        if (!cancelled) setCounters(next);
      } catch {
        // swallow — keep last known counters
      }
    }

    refresh();
    const id = window.setInterval(refresh, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);

  return counters;
}
