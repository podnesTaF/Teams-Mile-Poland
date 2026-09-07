import Link from "next/link";
import { getSubmissionById } from "@/lib/submissions-store";
import { PrintButton } from "@/components/PrintButton";
import { SubmissionPrintout } from "@/components/SubmissionPrintout";
import { LOCALES, type Locale } from "@/lib/types";
import { LOCALE_META } from "@/content/locales-meta";

export const dynamic = "force-dynamic";

/**
 * Wydruk/zapis PDF dla WIELU zaznaczonych zgłoszeń naraz — wywoływany z
 * checkboxów w tabeli /admin (patrz components/AdminSubmissionsTable.tsx).
 * URL: /admin/submissions/print?ids=id1,id2,id3&lang=pl
 *
 * Domyślnie (bez `?lang=`) każde zgłoszenie drukuje się w SWOIM WŁASNYM
 * języku (submission.locale) — tak jak na pojedynczej stronie
 * `/admin/submissions/[id]`. Jeśli administrator poda `?lang=`, ta sama
 * wartość jest wymuszona dla WSZYSTKICH zaznaczonych zgłoszeń naraz
 * (przydatne np. gdy trzeba złożyć jednolity komplet po polsku do
 * własnej dokumentacji, niezależnie od języka, w którym uczestnicy
 * wypełniali formularz).
 */
export default function BulkPrintPage({
  searchParams,
}: {
  searchParams: { ids?: string; lang?: string };
}) {
  const ids = (searchParams.ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const submissions = ids
    .map((id) => getSubmissionById(id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const forcedLocale = (LOCALES as string[]).includes(searchParams.lang ?? "")
    ? (searchParams.lang as Locale)
    : null;

  return (
    <div>
      <div className="no-print mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="text-sm font-semibold text-brand-textMuted transition-colors hover:text-brand-text"
          >
            ← Wszystkie zgłoszenia
          </Link>
          <h1 className="mt-3 font-display text-2xl uppercase tracking-tight">
            Wydruk zbiorczy
            <span className="ml-2 rounded-pill bg-brand-accentSoft px-2 py-0.5 text-xs font-bold uppercase text-brand-accent">
              {submissions.length} zgłoszeń
            </span>
          </h1>
          <p className="mt-1 text-xs text-brand-textMuted">
            {forcedLocale
              ? `Wymuszony język wydruku dla wszystkich: ${LOCALE_META[forcedLocale].label}.`
              : "Każde zgłoszenie drukowane w swoim własnym języku (tak jak zostało wypełnione)."}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <nav
            aria-label="Wymuszony język wydruku"
            className="flex items-center gap-1 rounded-pill border border-brand-border bg-white/5 p-1"
          >
            <Link
              href={`/admin/submissions/print?ids=${ids.join(",")}`}
              className={`rounded-pill px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                !forcedLocale
                  ? "bg-brand-gradient text-brand-bg"
                  : "text-brand-textMuted hover:text-brand-text"
              }`}
            >
              auto
            </Link>
            {LOCALES.map((loc) => (
              <Link
                key={loc}
                href={`/admin/submissions/print?ids=${ids.join(",")}&lang=${loc}`}
                className={`rounded-pill px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                  loc === forcedLocale
                    ? "bg-brand-gradient text-brand-bg"
                    : "text-brand-textMuted hover:text-brand-text"
                }`}
              >
                {LOCALE_META[loc].short}
              </Link>
            ))}
          </nav>
          <PrintButton label={`Drukuj ${submissions.length} zgłoszeń / zapisz jako PDF`} />
        </div>
      </div>

      {submissions.length === 0 ? (
        <p className="text-brand-textMuted">
          Brak zaznaczonych zgłoszeń — wróć do tabeli i zaznacz co najmniej
          jedno.
        </p>
      ) : (
        <div className="print-area space-y-8">
          {submissions.map((submission, i) => {
            const submissionLocale = (
              ["pl", "en", "ua", "ru"].includes(submission.locale)
                ? submission.locale
                : "pl"
            ) as Locale;
            return (
              <SubmissionPrintout
                key={submission.id}
                submission={submission}
                locale={forcedLocale ?? submissionLocale}
                pageBreakAfter={i < submissions.length - 1}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
