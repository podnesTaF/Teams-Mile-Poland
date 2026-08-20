import { setRequestLocale } from "next-intl/server";

import { requireAdmin } from "@/features/admin/action-helpers";
import { AdminFlash } from "@/features/admin/components/admin-flash";
import { EventForm } from "@/features/admin/components/event-form";
import { NoDatabaseNotice } from "@/features/admin/components/no-database-notice";
import { adminButton } from "@/features/admin/components/shell/admin-button";
import { ADMIN_NOTE, ADMIN_TITLE, adminCard } from "@/features/admin/components/shell/admin-card";
import { AdminPage } from "@/features/admin/components/shell/admin-page";
import { createEvent } from "@/features/admin/event-actions";
import type { FlashQuery } from "@/features/admin/flash";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type PageProps = {
  params: Promise<{ locale: string }>;
  /** `createEvent`'s refusals redirect back here with a flash code. */
  searchParams: Promise<FlashQuery>;
};

/**
 * Adding a race night — the whole page is one form on `createEvent`, so it gates
 * where that action gates: `edit`, and a 404 below it rather than a form whose
 * submit would 404. Nothing links here from a view-only events index.
 *
 * Status is not a field. A created event is always a `draft`: admin-only, 404 on
 * every public surface, absent from the landing — the only safe default for a
 * night nobody has announced yet. Announcing it is a press on its Settings tab,
 * which is where this form redirects to on success.
 */
export default async function AdminEventNewPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  await requireAdmin(locale, "edit");

  return (
    <AdminPage
      eyebrow="Events"
      title="New event"
      actions={
        <Link href="/admin/events" className={adminButton()}>
          All events
        </Link>
      }
    >
      {process.env.DATABASE_URL ? (
        <>
          <AdminFlash query={query} />

          <section className={adminCard("p-4 sm:p-5")}>
            <h2 className={ADMIN_TITLE}>Create a race night</h2>
            <p className={cn(ADMIN_NOTE, "mt-1.5 max-w-[78ch]")}>
              Events are rows, so this takes effect without a deploy: the new night appears in the
              sidebar, on the events index and in the mailings segment picker straight away, and its
              public pages stay 404 until you move it on from draft. The defaults are the series as
              it actually runs — change the date, pick the window, and the rest is usually right.
            </p>
            <div className="mt-4">
              <EventForm action={createEvent} locale={locale} submitLabel="Create draft event" />
            </div>
          </section>
        </>
      ) : (
        <NoDatabaseNotice>create events</NoDatabaseNotice>
      )}
    </AdminPage>
  );
}
