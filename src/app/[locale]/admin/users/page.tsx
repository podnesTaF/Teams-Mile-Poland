import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { requireAdmin } from "@/features/admin/action-helpers";
import { AdminShell } from "@/features/admin/components/admin-shell";

export default async function AdminUsersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin(locale);

  return (
    <AdminShell locale={locale} title="Users" active="users">
      <section className="iv-card" style={{ marginTop: 20 }}>
        <p className="iv-note">
          User management ships in an upcoming slice: search, verified/participation filters, and
          per-user detail pages. Nothing to manage here yet.
        </p>
      </section>
    </AdminShell>
  );
}
