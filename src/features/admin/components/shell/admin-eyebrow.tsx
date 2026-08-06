import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The admin layer's small uppercase mono label — sidebar group headings, the
 * topbar's context line above a page title, status lines on cards. Shared so
 * the one type treatment does not get re-typed as a class string per surface.
 */
export function AdminEyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "truncate font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-admin-muted",
        className,
      )}
    >
      {children}
    </p>
  );
}
