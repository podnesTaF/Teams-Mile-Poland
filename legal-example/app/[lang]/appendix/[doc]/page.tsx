import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  LOCALES,
  PUBLIC_APPENDIX_SLUGS,
  type Locale,
  type InternalDocSlug,
} from "@/lib/types";
import { getDictionary } from "@/content/dictionaries";
import { getLegalHtml } from "@/lib/legal-texts";
import { listEvents, getNextOpenEvent } from "@/lib/events";
import { Container } from "@/components/Container";
import { LegalContent } from "@/components/LegalContent";

/**
 * Publiczna strona z pełnym tekstem Załącznika 1–5 (harmonogramy,
 * kategorie i pula nagród, kryteria rankingowe serii TEAM MILE POLAND).
 * WYŁĄCZNIE do czytania — bez pól, bez zgody/podpisu. W przeciwieństwie
 * do LIA/Potwierdzenia/Provisions on the Team Captain (patrz
 * TEAM_INTERNAL_DOCUMENT_SLUGS), te pięć załączników jest jawnie
 * udostępnione uczestnikom do wglądu, nie tylko administratorom.
 */

export function generateStaticParams() {
  return LOCALES.flatMap((lang) =>
    PUBLIC_APPENDIX_SLUGS.map((doc) => ({ lang, doc })),
  );
}

function resolveParams(lang: string, doc: string) {
  if (!(LOCALES as string[]).includes(lang)) return null;
  if (!(PUBLIC_APPENDIX_SLUGS as string[]).includes(doc)) return null;
  return { locale: lang as Locale, docSlug: doc as InternalDocSlug };
}

export function generateMetadata({
  params,
}: {
  params: { lang: string; doc: string };
}): Metadata {
  const resolved = resolveParams(params.lang, params.doc);
  if (!resolved) return {};
  const dict = getDictionary(resolved.locale);
  const meta = dict.internalDocuments[resolved.docSlug];
  return { title: `${meta.title} — ${dict.siteName}` };
}

export default function PublicAppendixPage({
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
  const meta = dict.internalDocuments[docSlug];
  const { html, usedFallback } = getLegalHtml(locale, docSlug);
  const events = listEvents();
  const eventId =
    events.find((e) => e.id === searchParams.event)?.id ??
    getNextOpenEvent().id;

  return (
    <Container className="max-w-3xl">
      <Link
        href={`/${locale}?event=${eventId}&type=team`}
        className="text-sm font-semibold text-brand-textMuted transition-colors hover:text-brand-text"
      >
        {dict.form.backToDocuments}
      </Link>

      <span className="eyebrow mt-6 block w-fit">{meta.kicker}</span>
      <h1 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
        {meta.title}
      </h1>

      <div className="mt-4 space-y-3 text-brand-textMuted">
        {meta.intro.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

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

      <div className="mt-8">
        <Link
          href={`/${locale}?event=${eventId}&type=team`}
          className="btn-primary"
        >
          {dict.form.backToDocuments}
        </Link>
      </div>
    </Container>
  );
}
