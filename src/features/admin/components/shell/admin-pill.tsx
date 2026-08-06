import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The admin layer's small pill — a count or a state inside a card, which is what
 * `.iv-pill` is on the pages that have not been redesigned yet (ADR 0004).
 *
 * Deliberately toned rather than typed: `EventStatusBadge` and
 * `ParticipationBadge` own the two vocabularies that mean something everywhere in
 * the panel, and this is for the ones that only mean something inside the card
 * they sit in — a heat's draft/published/finished, how many bibs are out, how many
 * people are waiting.
 */

const TONES = {
  muted: "text-admin-muted",
  ink: "text-admin-ink-2",
  warn: "text-admin-warn",
  ok: "text-admin-ok",
  accent: "text-admin-accent",
} as const;

const DOTS = {
  muted: "bg-admin-muted",
  ink: "bg-admin-ink-2",
  warn: "bg-admin-warn",
  ok: "bg-admin-ok",
  accent: "bg-admin-accent",
} as const;

export type AdminPillTone = keyof typeof TONES;

export function AdminPill({
  tone = "muted",
  dot = false,
  title,
  className,
  children,
}: {
  tone?: AdminPillTone;
  dot?: boolean;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-pill border border-admin-line bg-admin-surface-2 px-2.5 py-1",
        "font-mono text-[10px] font-medium uppercase leading-none tracking-[0.14em]",
        TONES[tone],
        className,
      )}
    >
      {dot ? <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", DOTS[tone])} /> : null}
      {children}
    </span>
  );
}
