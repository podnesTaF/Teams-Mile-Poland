import type { ReactNode } from "react";

/** Rendered instead of a page body when DATABASE_URL is not configured. */
export function NoDatabaseNotice({ children }: { children: ReactNode }) {
  return (
    <div className="iv-notice iv-notice--info">
      No database connected. Set <code>DATABASE_URL</code> to {children}.
    </div>
  );
}
