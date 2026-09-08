import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { requireAdmin } from "@/features/admin/action-helpers";
import { ADMIN_NOTE, ADMIN_TITLE, adminCard } from "@/features/admin/components/shell/admin-card";
import { AdminEmptyState } from "@/features/admin/components/shell/admin-empty-state";
import {
  StatementsTable,
  type StatementListRow,
} from "@/features/admin/components/statements-table";
import { getStatementRoster } from "@/features/admin/statements";
import { getEventBySlug } from "@/lib/events/registry";
import { docSetForEventType, getDocsForSet } from "@/lib/legal/manifest";
import { cn } from "@/lib/utils";

type PageProps = { params: Promise<{ locale: string; slug: string }> };

/**
 * The Statements tab: for every runner entered for this night, the Statement
 * they accepted — or the plain fact that no consent was ever recorded.
 *
 * Gated on `personal_data` (ADR 0007), not on `view`: the document behind each
 * link carries a date of birth, a home address, a phone number and an emergency
 * contact, so `admin_checkin` and `admin_viewer` get a 404 here even though they
 * can read every other tab of the same event.
 *
 * English-only chrome, like the rest of the admin panel. The *language* offered
 * per row is a different thing entirely — it is the language of the legal text,
 * and its default is the locale the submission recorded, because that is the
 * copy the runner actually read.
 *
 * The rows and their ticks live in a client island (#55) so a whole night can go
 * to the print route in one press; this page still does every read and every
 * format, and hands the island plain strings.
 */

/** Warsaw-local stamp for the "accepted" column — the same tone the roster uses. */
const ACCEPTED_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Warsaw",
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function AdminEventStatementsPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  await requireAdmin(locale, "personal_data");

  const event = await getEventBySlug(slug);
  if (!event || event.eventType !== "individual") notFound();

  const rows = await getStatementRoster(slug);
  const withConsent = rows.filter((row) => row.consent).length;

  // The Statement's own English title, for the panel's heading: admin chrome is
  // English whatever locale the URL carries.
  const t = await getTranslations({ locale: "en", namespace: "legal" });
  const statementDoc = getDocsForSet(docSetForEventType(event.eventType)).find(
    (doc) => doc.personalised,
  );
  const docTitle = statementDoc ? t(`docs.${statementDoc.slug}`) : "Participant Statement";

  if (rows.length === 0) {
    return (
      <div data-statements-empty="none">
        <AdminEmptyState title="No runners have entered yet">
          There are no registrations for this night, so there is nothing to print. Statements appear
          here as soon as someone enters and accepts the documents.
        </AdminEmptyState>
      </div>
    );
  }

  // Formatted here, not in the island: the island is a set of ticks, and every
  // value it renders should already be a string by the time it gets there.
  const listRows: StatementListRow[] = rows.map((row) => ({
    registrationId: row.registrationId,
    name: row.name,
    email: row.email,
    bib: row.bib === null ? "—" : String(row.bib),
    acceptedAtLabel: row.consent ? ACCEPTED_FMT.format(row.consent.acceptedAt) : null,
    recordedLocale: row.consent?.locale ?? null,
  }));

  return (
    <section className={adminCard("overflow-hidden")} data-statements-list="">
      <header className="border-b border-admin-line px-4 py-3.5 sm:px-5">
        <h2 className={ADMIN_TITLE}>{docTitle}</h2>
        <p className={cn(ADMIN_NOTE, "mt-1 max-w-[70ch]")}>
          {withConsent} of {rows.length}{" "}
          {rows.length === 1 ? "registration has" : "registrations have"} a consent record. Each
          statement opens in the language the runner read it in; the other two are convenience
          translations of the same document — the recorded language is the operative one. Tick
          runners to print a batch: one sheet each, in one pass.
        </p>
      </header>

      <StatementsTable slug={slug} rows={listRows} />
    </section>
  );
}
