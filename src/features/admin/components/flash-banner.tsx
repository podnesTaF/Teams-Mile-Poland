"use client";

import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useEffect, useState } from "react";

import type { FlashTone } from "@/features/admin/flash";
import { cn } from "@/lib/utils";

/**
 * The banner itself: the only client island in the flash path, holding nothing
 * but "has it been dismissed" and its auto-hide timer.
 *
 * It is rendered by {@link AdminFlash}, which resolves the copy on the server
 * and gives this a fresh `key` per request — so a repeated action, whose
 * redirect lands on the very same URL, still remounts the banner instead of
 * inheriting the dismissal of the one before it.
 */

/**
 * How long a flash sits before it hides itself. A refusal gets twice as long as
 * a confirmation: "moved 12 runners" is read at a glance, "publishing failed"
 * is read properly.
 */
const HIDE_AFTER_MS: Record<FlashTone, number> = {
  ok: 6000,
  info: 6000,
  error: 12000,
};

const TONE_STYLE: Record<FlashTone, { rule: string; icon: string }> = {
  ok: { rule: "shadow-[inset_3px_0_0_var(--admin-ok)]", icon: "text-admin-ok" },
  error: { rule: "shadow-[inset_3px_0_0_var(--admin-accent)]", icon: "text-admin-accent" },
  info: { rule: "shadow-[inset_3px_0_0_var(--admin-info)]", icon: "text-admin-info" },
};

const TONE_ICON: Record<FlashTone, typeof Info> = {
  ok: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

export function FlashBanner({ tone, message }: { tone: FlashTone; message: string }) {
  const [dismissed, setDismissed] = useState(false);
  // Someone reading — or reaching for the close button — should not have the
  // sentence vanish out from under them. Leaving restarts the full countdown.
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (held) return;
    const timer = setTimeout(() => setDismissed(true), HIDE_AFTER_MS[tone]);
    return () => clearTimeout(timer);
  }, [held, tone]);

  if (dismissed) return null;

  const style = TONE_STYLE[tone];
  const Icon = TONE_ICON[tone];

  return (
    <div
      // A refusal interrupts; a confirmation waits its turn in the queue.
      role={tone === "error" ? "alert" : "status"}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      className={cn(
        "mb-4 flex items-start gap-3 rounded-admin-lg border border-admin-line bg-admin-surface px-4 py-3",
        style.rule,
      )}
    >
      <Icon className={cn("mt-px h-4 w-4 shrink-0", style.icon)} aria-hidden />
      <p className="flex-1 font-sans text-[13.5px] font-medium normal-case not-italic leading-snug text-admin-ink">
        {message}
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-admin text-admin-muted transition-colors hover:bg-admin-surface-2 hover:text-admin-ink"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only">Dismiss</span>
      </button>
    </div>
  );
}
