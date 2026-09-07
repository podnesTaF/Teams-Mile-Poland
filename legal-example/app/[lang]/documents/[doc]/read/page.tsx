import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  LOCALES,
  DOCUMENT_SLUGS,
  TEAM_DOCUMENT_SLUGS,
  type Locale,
  type DocumentSlug,
} from "@/lib/types";
import { getDictionary, getRegisterContent } from "@/content/dictionaries";
import { getLegalHtml } from "@/lib/legal-texts";
import { fillLegalTemplate, formatSpelledDate } from "@/lib/fill-legal-template";
import { listEvents, getNextOpenEvent } from "@/lib/events";
import { Container } from "@/components/Container";
import { LegalContent } from "@/components/LegalContent";

const ALL_DOCUMENT_SLUGS: DocumentSlug[] = [
  ...DOCUMENT_SLUGS,
  ...TEAM_DOCUMENT_SLUGS,
];

export function generateStaticParams() {
  return LOCALES.flatMap((lang) =>
    ALL_DOCUMENT_SLUGS.map((doc) => ({ lang, doc })),
  );
}

function resolveParams(lang: string, doc: string) {
  if (!(LOCALES as string[]).includes(lang)) return null;
  if (!(ALL_DOCUMENT_SLUGS as string[]).includes(doc)) return null;
  return { locale: lang as Locale, docSlug: doc as DocumentSlug };
}

export function generateMetadata({
  params,
}: {
  params: { lang: string; doc: string };
}): Metadata {
  const resolved = resolveParams(params.lang, params.doc);
  if (!resolved) return {};
  const dict = getDictionary(resolved.locale);
  const doc = dict.documents[resolved.docSlug];
  return { title: `${doc.officialDocLabel} — ${dict.siteName}` };
}

/**
 * Strona z PEŁNYM tekstem dokumentu — bez żadnych pól do wypełnienia
 * (te są na stronie formularza, o segment wyżej). Wyłącznie do czytania:
 * uczestnik ma tu dostęp do treści, na podstawie której świadomie
 * zaznacza zgody na stronie /documents/[doc].
 *
 * Obsługuje zarówno dokumenty formatu indywidualnego, jak i "team-*"
 * (TEAM MILE POLAND) — oba zestawy slugów są w ALL_DOCUMENT_SLUGS, a
 * lib/legal-texts.ts samo rozpoznaje prefiks "team-" i czyta z
 * content/legal-texts-team.
 */
export default function DocumentReadPage({
  params,
  searchParams,
}: {
  params: { lang: string; doc: string };
  searchParams: { event?: string };
}) {
  const resolved = resolveParams(params.lang, params.doc);
  if (!resolved) notFound();
  const { locale, docSlug } = resolved;

  const dict = getDictionary(locale);
  const doc = dict.documents[docSlug];
  const { html: rawHtml, usedFallback } = getLegalHtml(locale, docSlug);
  const events = listEvents();
  const selectedEvent =
    events.find((e) => e.id === searchParams.event) ?? getNextOpenEvent();
  const eventId = selectedEvent.id;
  const registerContent = getRegisterContent(locale, selectedEvent.eventType);

  // Wstawiamy datę WYBRANEGO wydarzenia od razu — uczestnik czyta dokument
  // dotyczący konkretnej edycji. Dane osobowe i data podpisania jeszcze nie
  // istnieją na tym etapie, więc zostają jako puste linie do wypełnienia.
  // (Tokeny __EVENT_DATE__ itp. są obecnie rozstawione w treści dokumentów
  // formatu indywidualnego — oswiadczenie/rodo; jeśli w danym dokumencie
  // ich nie ma, poniższe wywołanie jest no-opem i tekst zostaje bez zmian.)
  const html = rawHtml
    ? fillLegalTemplate(rawHtml, locale, {
        eventDate: formatSpelledDate(selectedEvent.dateISO, locale),
      })
    : rawHtml;

  return (
    <Container className="max-w-3xl">
      <Link
        href={`/${locale}?event=${eventId}`}
        className="text-sm font-semibold text-brand-textMuted transition-colors hover:text-brand-text"
      >
        {dict.form.backToDocuments}
      </Link>

      <span className="eyebrow mt-6 block w-fit">{doc.kicker}</span>
      <h1 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
        {doc.officialDocLabel}
      </h1>

      {usedFallback && (
        <p className="mt-4 rounded-xl border border-brand-accent/30 bg-brand-accentSoft px-4 py-3 text-sm text-brand-accent">
          {dict.form.fallbackNotice}
        </p>
      )}

      {html ? (
        <div className="card mt-6 p-6 sm:p-8">
          <LegalContent html={html} />
        </div>
      ) : (
        <p className="mt-6 text-brand-textMuted">—</p>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={`/${locale}?event=${eventId}`} className="btn-secondary">
          {dict.form.backToDocuments}
        </Link>
        <Link
          href={`/${locale}/register?event=${eventId}`}
          className="btn-primary"
        >
          {registerContent.submitLabel}
        </Link>
      </div>
    </Container>
  );
}
