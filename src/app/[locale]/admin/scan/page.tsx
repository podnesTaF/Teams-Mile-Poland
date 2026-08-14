import { setRequestLocale } from "next-intl/server";

import { requireAdmin } from "@/features/admin/action-helpers";
import { TicketScanner } from "@/features/admin/components/checkin/ticket-scanner";
import { AdminPage } from "@/features/admin/components/shell/admin-page";

/**
 * The volunteer's scan page (PRD: volunteer check-in interface). Not tied to an
 * event: the ticket QR carries the registration id, so the scanner lands on the
 * runner's ticket page and its admin panel resolves the event from the row —
 * one scan station covers whatever races are on that morning.
 *
 * Gated on the `checkin` capability rather than plain view: the only thing this
 * page leads to is the check-in panel, which a view-only admin doesn't get.
 */
export default async function AdminScanPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin(locale, "checkin");

  return (
    <AdminPage title="Scan ticket" narrow>
      <TicketScanner />
    </AdminPage>
  );
}
