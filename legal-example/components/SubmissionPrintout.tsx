import { getEventById } from "@/lib/events";
import { getDictionary, getRegisterContent } from "@/content/dictionaries";
import { getLegalHtml } from "@/lib/legal-texts";
import {
  fillLegalTemplate,
  formatSpelledDate,
  formatSpelledDateFromInstant,
} from "@/lib/fill-legal-template";
import { LegalContent } from "@/components/LegalContent";
import { PRINT_LABELS } from "@/content/print-labels";
import { DOCUMENT_SLUGS_BY_EVENT_TYPE, type DocumentSlug, type EventType, type Locale } from "@/lib/types";
import type { StoredSubmission } from "@/lib/submissions-store";

/**
 * Jeden "arkusz" wydruku — wszystkie podpisane dokumenty jednego
 * zgłoszenia, z podstawionymi tokenami (data wydarzenia, data
 * podpisania, dane uczestnika). Używane zarówno na
 * `/admin/submissions/[id]` (jedno zgłoszenie) jak i na
 * `/admin/submissions/print` (wiele zaznaczonych zgłoszeń naraz —
 * patrz `pageBreakAfter`, które oddziela kolejne arkusze na wydruku).
 */
export function SubmissionPrintout({
  submission,
  locale,
  pageBreakAfter = false,
}: {
  submission: StoredSubmission;
  locale: Locale;
  pageBreakAfter?: boolean;
}) {
  const dict = getDictionary(locale);
  const t = PRINT_LABELS[locale];
  const event = getEventById(submission.eventId);
  const eventType: EventType = event?.eventType ?? "individual";
  const isUnifiedRegistration = submission.docSlug === "registration";

  const docSlugsToRender: DocumentSlug[] = isUnifiedRegistration
    ? DOCUMENT_SLUGS_BY_EVENT_TYPE[eventType]
    : (Object.values(DOCUMENT_SLUGS_BY_EVENT_TYPE).flat() as string[]).includes(
          submission.docSlug,
        )
      ? [submission.docSlug as DocumentSlug]
      : [];

  const signDate = formatSpelledDateFromInstant(submission.receivedAt, locale);
  const eventDate = event ? formatSpelledDate(event.dateISO, locale) : "";

  const fillTokens = {
    eventDate,
    signDate,
    fullName: submission.fields.fullName,
    birthDate: submission.fields.birthDate,
    phoneEmail: submission.fields.phoneOrEmail,
    address: submission.fields.address,
    emergencyContact: submission.fields.emergencyContact,
  };

  const checkboxSource = isUnifiedRegistration
    ? getRegisterContent(locale, eventType)
    : dict.documents[submission.docSlug as DocumentSlug];

  return (
    <div
      className="space-y-8"
      style={pageBreakAfter ? { breakAfter: "page" } : undefined}
    >
      <div className="card p-6 sm:p-10">
        <header className="mb-6 border-b border-neutral-300 pb-5">
          <p className="text-xs uppercase tracking-widest text-brand-accent">
            {t.signedElectronically}
          </p>
          <h2 className="mt-2 font-display text-2xl uppercase tracking-tight">
            {submission.fields.fullName || t.participantFallbackName}
          </h2>
          {event && (
            <p className="mt-1 text-sm text-brand-textMuted">
              {event.venueName}, {event.venueAddress} — {eventDate}
            </p>
          )}
          <p className="mt-1 text-sm text-brand-textMuted">
            {t.signDateLabel}: <strong>{signDate}</strong>, {t.ipAddressLabel}:{" "}
            <strong>{submission.ip ?? "—"}</strong>
          </p>
        </header>

        {checkboxSource && checkboxSource.fields.length > 0 && (
          <section className="mb-6">
            <h3 className="mb-3 font-display text-lg uppercase tracking-tight">
              {t.participantDataHeading}
            </h3>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {checkboxSource.fields.map((f) => {
                const value = submission.fields[f.name];
                if (!value) return null;
                return (
                  <div key={f.name}>
                    <dt className="text-xs uppercase tracking-wide text-brand-textMuted">
                      {f.label}
                    </dt>
                    <dd className="font-semibold">{value}</dd>
                  </div>
                );
              })}
            </dl>
          </section>
        )}

        {checkboxSource && checkboxSource.checkboxes.length > 0 && (
          <section className="mb-6">
            <h3 className="mb-3 font-display text-lg uppercase tracking-tight">
              {t.confirmedConsentsHeading}
            </h3>
            <ul className="space-y-2">
              {checkboxSource.checkboxes.map((cb) => {
                const checked = Boolean(submission.checkboxes[cb.id]);
                return (
                  <li key={cb.id} className="flex items-start gap-2 text-sm">
                    <span
                      className={
                        checked ? "text-brand-success" : "text-brand-textMuted"
                      }
                    >
                      {checked ? "☑" : "☐"}
                    </span>
                    <span>{cb.label}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {checkboxSource?.imageConsent && (
          <section>
            <h3 className="mb-3 font-display text-lg uppercase tracking-tight">
              {checkboxSource.imageConsent.question}
            </h3>
            <p className="text-sm font-semibold">
              {submission.imageConsent === "agree"
                ? "☑ " + checkboxSource.imageConsent.agreeLabel
                : submission.imageConsent === "disagree"
                  ? "☑ " + checkboxSource.imageConsent.disagreeLabel
                  : t.imageConsentNotChosen}
            </p>
          </section>
        )}
      </div>

      {docSlugsToRender.map((slug) => {
        const { html: rawHtml } = getLegalHtml(locale, slug);
        if (!rawHtml) return null;
        const filledHtml = fillLegalTemplate(rawHtml, locale, fillTokens);
        return (
          <div key={slug} className="card p-6 sm:p-10">
            <h3 className="mb-4 font-display text-xl uppercase tracking-tight text-brand-accent">
              {t.fullDocumentTextHeading(dict.documents[slug].title)}
            </h3>
            <LegalContent html={filledHtml} variant="print" />
          </div>
        );
      })}
    </div>
  );
}
