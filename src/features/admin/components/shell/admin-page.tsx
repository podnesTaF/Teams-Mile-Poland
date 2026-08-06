import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { AdminTopbar } from "./admin-topbar";

/**
 * What an admin page renders instead of the old `AdminShell` wrapper: its
 * topbar (title, eyebrow, page actions) plus the content column.
 *
 * The *shell* — dark root, sidebar, drawer — comes from the admin layout and is
 * inherited automatically, so a page that forgets this component still renders
 * inside the shell; all it loses is its own header. `narrow` keeps the
 * form-shaped pages (news editor) readable at the same 560px the old
 * `iv-wrap--narrow` used.
 *
 * The content column is the page's `<main>` landmark, as `iv-main` was before
 * the shell moved into the layout.
 */
export function AdminPage({
  title,
  eyebrow,
  actions,
  narrow = false,
  children,
}: {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  narrow?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <AdminTopbar title={title} eyebrow={eyebrow} actions={actions} />
      <main
        className={cn(
          "mx-auto w-full flex-1 px-4 pb-16 pt-6 sm:px-6",
          narrow ? "max-w-[560px]" : "max-w-[1400px]",
        )}
      >
        {children}
      </main>
    </>
  );
}
