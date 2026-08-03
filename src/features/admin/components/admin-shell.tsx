import type { ReactNode } from "react";

import { InteriorHeader } from "@/components/landing/interior-header";
import { LogOutButton } from "@/features/auth/components/log-out-button";
import { Link } from "@/i18n/navigation";

const NAV_ITEMS = [
  { key: "overview", label: "Overview", href: "/admin" },
  { key: "users", label: "Users", href: "/admin/users" },
  { key: "admins", label: "Admins", href: "/admin/admins" },
  { key: "inquiries", label: "Inquiries", href: "/admin/inquiries" },
  { key: "news", label: "News", href: "/admin/news" },
  { key: "legacy", label: "Legacy", href: "/admin/legacy" },
  { key: "mailings", label: "Mailings", href: "/admin/mailings" },
] as const;

export type AdminNavKey = (typeof NAV_ITEMS)[number]["key"];

/**
 * Shared chrome for every admin page: interior header, toolbar (eyebrow +
 * title + per-page actions + sign-out) and the section nav. Pages render
 * their content as children; `active` highlights the current section (omit
 * on pages outside the nav, e.g. per-event roster/check-in).
 *
 * Sign-out is the ordinary Better Auth one — an admin session *is* a user
 * session now, so there is nothing admin-specific left to clear.
 */
export function AdminShell({
  title,
  eyebrow = "Admin",
  active,
  actions,
  narrow = false,
  children,
}: {
  title: string;
  eyebrow?: string;
  active?: AdminNavKey;
  actions?: ReactNode;
  narrow?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className={narrow ? "iv-wrap iv-wrap--narrow" : "iv-wrap"}>
          <div className="iv-toolbar">
            <div>
              <span className="iv-eyebrow">{eyebrow}</span>
              <h1 className="iv-title">{title}</h1>
            </div>
            <div className="iv-inline">
              {actions}
              <LogOutButton className="btn btn-stroke btn-sm" />
            </div>
          </div>

          <nav className="iv-inline" aria-label="Admin sections" style={{ marginBottom: 18 }}>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`btn btn-sm ${active === item.key ? "btn-red" : "btn-stroke"}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {children}
        </div>
      </main>
    </div>
  );
}
