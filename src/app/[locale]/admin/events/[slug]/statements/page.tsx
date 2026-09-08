import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { requireAdmin } from "@/features/admin/action-helpers";
import { ADMIN_NOTE, ADMIN_TITLE, adminCard } from "@/features/admin/components/shell/admin-card";
import { AdminEmptyState } from "@/features/admin/components/shell/admin-empty-state";
import {
  getStatementRoster,
  type StatementRosterRow,
} from "@/features/admin/statements";
import { Link } from "@/i18n/navigation";
import { getEventBySlug } from "@/lib/events/registry";
import { type DocLocale, docSetForEventType, getDocsForSet } from "@/lib/legal/manifest";
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
 */

const HEAD_CELL =
  "px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-admin-muted";
const CELL = "px-3 py-2 align-middle text-[13px] text-admin-ink-2";

/** The three languages a Statement can be printed in, in publication order. */
const PRINT_LOCALES: readonly DocLocale[] = ["pl", "en", "ua"];

const LOCALE_LABEL: Record<DocLocale, string> = { pl: "PL", en: "EN", ua: "UA" };

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

  return (
    <section className={adminCard("overflow-hidden")} data-statements-list="">
      <header className="border-b border-admin-line px-4 py-3.5 sm:px-5">
        <h2 className={ADMIN_TITLE}>{docTitle}</h2>
        <p className={cn(ADMIN_NOTE, "mt-1 max-w-[70ch]")}>
          {withConsent} of {rows.length}{" "}
          {rows.length === 1 ? "registration has" : "registrations have"} a consent record. Each
          statement opens in the language the runner read it in; the other two are convenience
          translations of the same document — the recorded language is the operative one.
        </p>
      </header>

      <div className="admin-scroll overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-admin-line text-left">
              <th className={HEAD_CELL}>Runner</th>
              <th className={HEAD_CELL}>Bib</th>
              <th className={HEAD_CELL}>Consent</th>
              <th className={HEAD_CELL}>Statement</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <StatementRow key={row.registrationId} slug={slug} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** One registration: who it is, what was recorded, and the way into the print view. */
function StatementRow({ slug, row }: { slug: string; row: StatementRosterRow }) {
  const base = `/admin/events/${slug}/statements/print?ids=${encodeURIComponent(row.registrationId)}`;

  return (
    <tr
      className="border-b border-admin-line last:border-0"
      data-statement-row={row.registrationId}
      data-consent={row.consent ? "recorded" : "none"}
    >
      <td className={CELL}>
        <span className="block text-admin-ink">{row.name}</span>
        <span className="block text-[12px] text-admin-muted">{row.email}</span>
      </td>
      <td className={cn(CELL, "font-mono")}>{row.bib ?? "—"}</td>
      <td className={CELL}>
        {row.consent ? (
          <>
            <span className="block">{ACCEPTED_FMT.format(row.consent.acceptedAt)}</span>
            <span className="block text-[12px] text-admin-muted">
              Read in {LOCALE_LABEL[row.consent.locale]} · Europe/Warsaw
            </span>
          </>
        ) : (
          <span
            className="inline-flex items-center rounded-pill border border-admin-line-2 px-2 py-0.5 text-[11px] uppercase tracking-[0.08em] text-admin-muted"
            data-statement-state="no-consent"
          >
            No consent on record
          </span>
        )}
      </td>
      <td className={CELL}>
        {row.consent ? (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link
              href={base}
              className="text-admin-ink underline decoration-admin-line-2 underline-offset-2 hover:decoration-admin-accent"
              data-statement-view={row.registrationId}
            >
              View statement
            </Link>
            <span className="flex items-center gap-1.5 text-[11px] text-admin-muted">
              {PRINT_LOCALES.map((lang) => (
                <Link
                  key={lang}
                  href={`${base}&lang=${lang}`}
                  aria-label={`View this statement in ${LOCALE_LABEL[lang]}`}
                  className={cn(
                    "rounded-admin px-1.5 py-0.5 hover:bg-admin-surface-2 hover:text-admin-ink",
                    // The recorded language is not a preference among three —
                    // it is the text that was accepted, so it reads as the
                    // default and the other two as translations.
                    lang === row.consent?.locale && "text-admin-ink",
                  )}
                >
                  {LOCALE_LABEL[lang]}
                </Link>
              ))}
            </span>
          </span>
        ) : (
          <span className="text-[12px] text-admin-muted">
            Registered before consent was captured — nothing to print.
          </span>
        )}
      </td>
    </tr>
  );
}
