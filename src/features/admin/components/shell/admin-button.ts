import { cn } from "@/lib/utils";

/**
 * Button/link class strings for the Tailwind admin layer (ADR 0004).
 *
 * A class helper rather than a component so it works on whatever element the
 * caller needs — `Link`, `button`, a form submit — without a wrapper per shape.
 * The landing `.btn` family is deliberately not reused: it is italic uppercase
 * poster type, and the admin panel is a tool.
 */

export type AdminButtonVariant = "primary" | "stroke";

const BASE =
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-admin px-3.5 font-sans text-[13px] font-medium normal-case not-italic leading-none transition-colors";

const VARIANTS: Record<AdminButtonVariant, string> = {
  primary: "bg-admin-accent text-white hover:brightness-110",
  stroke:
    "border border-admin-line-2 text-admin-ink-2 hover:bg-admin-surface-2 hover:text-admin-ink",
};

export function adminButton(variant: AdminButtonVariant = "stroke", className?: string): string {
  return cn(BASE, VARIANTS[variant], className);
}
