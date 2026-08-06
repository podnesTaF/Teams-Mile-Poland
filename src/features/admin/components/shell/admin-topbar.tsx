import type { ReactNode } from "react";

import { LogOutButton } from "@/features/auth/components/log-out-button";
import { getAdminUser } from "@/lib/auth/user-session";

import { AdminEyebrow } from "./admin-eyebrow";
import { AdminMenuButton } from "./admin-menu-button";

/**
 * The slim admin topbar: drawer toggle, the page's eyebrow + title, the page's
 * own actions, and the signed-in admin with sign-out.
 *
 * Rendered by {@link AdminPage} rather than by the admin layout, because the
 * title and actions belong to the page and a layout cannot read them from its
 * children. The identity is read here instead of being threaded through every
 * page: this is presentation, never a gate — each page still calls
 * `requireAdmin` itself.
 *
 * `--admin-topbar-h` is its resting height, and `data-admin-topbar` marks it for
 * the one thing that has to stick directly below it and cannot be a row short:
 * the check-in desk's search field, which measures this element because page
 * actions wrap on a narrow screen and make the bar two rows tall.
 */
export async function AdminTopbar({
  title,
  eyebrow,
  actions,
}: {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  const admin = await getAdminUser();
  const who = admin?.name?.trim() || admin?.email || "";

  return (
    <header
      data-admin-topbar
      className="sticky top-0 z-30 border-b border-admin-line bg-admin-surface"
    >
      <div className="flex min-h-[var(--admin-topbar-h)] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <AdminMenuButton />
          <div className="min-w-0">
            {eyebrow ? <AdminEyebrow>{eyebrow}</AdminEyebrow> : null}
            <h1 className="truncate font-sans text-[17px] font-semibold normal-case not-italic leading-tight tracking-[-0.01em] text-admin-ink">
              {title}
            </h1>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          {actions}
          <div className="flex items-center gap-3 border-admin-line pl-1 sm:border-l sm:pl-3">
            {who ? (
              <span className="hidden max-w-[180px] truncate text-[12.5px] text-admin-muted md:block">
                {who}
              </span>
            ) : null}
            <LogOutButton className="inline-flex h-8 shrink-0 items-center rounded-admin border border-admin-line-2 px-3 font-sans text-[12.5px] font-medium normal-case not-italic text-admin-ink-2 transition-colors hover:bg-admin-surface-2 hover:text-admin-ink disabled:opacity-50" />
          </div>
        </div>
      </div>
    </header>
  );
}
