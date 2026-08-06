import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "@/app/admin.css";

import { buildAdminNav } from "@/features/admin/components/shell/admin-nav";
import { AdminShellFrame } from "@/features/admin/components/shell/admin-shell-frame";

/**
 * The admin application shell, inherited by every page under `/admin`.
 *
 * It contributes the dark root (`.ace-landing .iv` stays so the pages that have
 * not been redesigned yet keep rendering through their frozen `.iv-*` rules —
 * ADR 0004), the admin token set, the grouped sidebar and its mobile drawer.
 * Pages add their own topbar and content column via `AdminPage`.
 *
 * Deliberately *not* a gate: `requireAdmin` stays on every page and server
 * action. A layout is skipped on client-side navigations between its own pages,
 * so guarding here would be a false sense of security — see the parent PRD's
 * auth contract. Nothing admin-only is rendered here either; the nav is built
 * from the public event registry.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="ace-landing iv admin-root">
      <AdminShellFrame nav={buildAdminNav()}>{children}</AdminShellFrame>
    </div>
  );
}
