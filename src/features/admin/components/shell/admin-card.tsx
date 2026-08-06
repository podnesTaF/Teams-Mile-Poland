import { cn } from "@/lib/utils";

/**
 * The admin layer's panel, and the two type treatments that go inside it — what
 * `.iv-card`, `.iv-section-title` and `.iv-note` are on the not-yet-redesigned
 * pages (ADR 0004).
 *
 * A class helper rather than a component, like {@link adminButton}: a panel is a
 * `<section>` on one page and an `<li>` on the next, and the heat builder's cards
 * divide themselves into header / field / footer regions that no fixed set of
 * slots would fit. Padding is deliberately *not* included for the same reason —
 * a plain panel adds `p-4 sm:p-5`, a divided one pads each region instead.
 */
export function adminCard(className?: string): string {
  return cn("rounded-admin-lg border border-admin-line bg-admin-surface", className);
}

/** Panel heading type, applied to whichever level the page's outline calls for. */
export const ADMIN_TITLE =
  "font-sans text-[15px] font-semibold normal-case not-italic leading-tight tracking-[-0.01em] text-admin-ink";

/** The muted prose that explains a panel under its heading. */
export const ADMIN_NOTE = "text-[12.5px] leading-relaxed text-admin-muted";
