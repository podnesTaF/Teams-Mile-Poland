import { AlertTriangle, Info } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A standing note on an admin page: a condition worth looking at, not feedback
 * about an action just taken. The `.iv-notice` pair, rebuilt in the admin layer
 * (ADR 0004).
 *
 * Styled as {@link FlashBanner}'s quieter sibling — same panel, same inset tone
 * rule — but it is a server-rendered fact about the page, so it neither dismisses
 * nor auto-hides. Anything that *is* action feedback belongs in the flash
 * registry instead, so it reads the same on every surface.
 */

export type AdminNoticeTone = "warn" | "info";

const TONES: Record<AdminNoticeTone, { rule: string; ink: string; Icon: typeof Info }> = {
  warn: {
    rule: "shadow-[inset_3px_0_0_var(--admin-warn)]",
    ink: "text-admin-warn",
    Icon: AlertTriangle,
  },
  info: {
    rule: "shadow-[inset_3px_0_0_var(--admin-info)]",
    ink: "text-admin-info",
    Icon: Info,
  },
};

export function AdminNotice({
  tone = "warn",
  className,
  children,
}: {
  tone?: AdminNoticeTone;
  className?: string;
  children: ReactNode;
}) {
  const { rule, ink, Icon } = TONES[tone];

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-admin-lg border border-admin-line bg-admin-surface px-4 py-3",
        rule,
        className,
      )}
    >
      <Icon className={cn("mt-px h-4 w-4 shrink-0", ink)} aria-hidden />
      <p className="flex-1 text-[13px] leading-relaxed text-admin-ink-2">{children}</p>
    </div>
  );
}
