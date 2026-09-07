import { notFound } from "next/navigation";
import Link from "next/link";
import { getSubmissionById } from "@/lib/submissions-store";
import { PrintButton } from "@/components/PrintButton";
import { SubmissionPrintout } from "@/components/SubmissionPrintout";
import { formatDateTimeWarsaw } from "@/lib/fill-legal-template";
import { LOCALE_META } from "@/content/locales-meta";
import { getAnyDocumentTitle } from "@/content/dictionaries";
import { getEventById } from "@/lib/events";
import { DOCUMENT_SLUGS_BY_EVENT_TYPE, LOCALES, type EventType, type Locale } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function SubmissionDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { lang?: string };
}) {
  const submission = getSubmissionById(params.id);
  if (!submission) notFound();

  const submissionLocale = (
    ["pl", "en", "ua", "ru"].includes(submission.locale)
      ? submission.locale
      : "pl"
  ) as Locale;

  // Domyślnie drukujemy w JĘZYKU ZGŁOSZENIA — ale administrator może to
  // jawnie nadpisać przełącznikiem poniżej (np. żeby wydrukować polską
  // kopię do własnej dokumentacji niezależnie od języka, w którym
  // uczestnik wypełniał formularz). Patrz components/SubmissionPrintout.tsx
  // dla właściwej treści dokumentu w wybranym języku.
  const locale = (
    (LOCALES as string[]).includes(searchParams.lang ?? "")
      ? (searchParams.lang as Locale)
      : submissionLocale
  );

  const event = getEventById(submission.eventId);
  const eventType: EventType = event?.eventType ?? "individual";
  const docTitle = getAnyDocumentTitle(locale, submission.docSlug, eventType);
  const isUnifiedRegistration = submission.docSlug === "registration";
  const docCount = DOCUMENT_SLUGS_BY_EVENT_TYPE[eventType].length;

  return (
    <div>
      {/* Pasek narzędzi administratora — niewidoczny na wydruku (.no-print) */}
      <div className="no-print mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="text-sm font-semibold text-brand-textMuted transition-colors hover:text-brand-text"
          >
            ← Wszystkie zgłoszenia
          </Link>
          <h1 className="mt-3 font-display text-2xl uppercase tracking-tight">
            {docTitle}
            {isUnifiedRegistration && (
              <span className="ml-2 rounded-pill bg-brand-accentSoft px-2 py-0.5 text-xs font-bold uppercase text-brand-accent">
                {docCount} dokumenty · {eventType === "team" ? "TEAM MILE" : "indywidualny"}
              </span>
            )}
            <span className="ml-2 rounded-pill border border-brand-border px-2 py-0.5 text-xs font-bold uppercase text-brand-textMuted">
              Język zgłoszenia: {LOCALE_META[submissionLocale].short}
            </span>
          </h1>
          <dl className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-brand-textMuted sm:grid-cols-4">
            <div>
              <dt className="uppercase tracking-wide">ID zgłoszenia</dt>
              <dd className="font-mono text-brand-text">{submission.id}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide">Przesłano</dt>
              <dd className="text-brand-text">
                {formatDateTimeWarsaw(submission.receivedAt)}
              </dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide">Adres IP</dt>
              <dd className="text-brand-text">{submission.ip ?? "—"}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide">Przeglądarka</dt>
              <dd className="truncate text-brand-text" title={submission.userAgent ?? ""}>
                {submission.userAgent ?? "—"}
              </dd>
            </div>
          </dl>
        </div>
        <div className="flex flex-col items-end gap-3">
          <nav
            aria-label="Język wydruku"
            className="flex items-center gap-1 rounded-pill border border-brand-border bg-white/5 p-1"
          >
            {LOCALES.map((loc) => (
              <Link
                key={loc}
                href={`/admin/submissions/${submission.id}?lang=${loc}`}
                className={`rounded-pill px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                  loc === locale
                    ? "bg-brand-gradient text-brand-bg"
                    : "text-brand-textMuted hover:text-brand-text"
                }`}
              >
                {LOCALE_META[loc].short}
              </Link>
            ))}
          </nav>
          {locale !== submissionLocale && (
            <p className="max-w-[220px] text-right text-xs text-brand-accent">
              Uczestnik wypełnił formularz po{" "}
              {LOCALE_META[submissionLocale].label.toLowerCase()} — wybrano
              inny język wydruku ręcznie.
            </p>
          )}
          <PrintButton label="Drukuj / zapisz jako PDF" />
        </div>
      </div>

      {/* OBSZAR WYDRUKU — dokładnie to, co widzi drukarka (.print-area) */}
      <div className="print-area">
        <SubmissionPrintout submission={submission} locale={locale} />
      </div>
    </div>
  );
}
