import Link from "next/link";
import { notFound } from "next/navigation";
import {
  INTERNAL_DOCUMENT_SLUGS,
  TEAM_INTERNAL_DOCUMENT_SLUGS,
  LOCALES,
  type InternalDocSlug,
  type Locale,
} from "@/lib/types";
import { getDictionary } from "@/content/dictionaries";
import { getLegalHtml, hasNativeLegalHtml } from "@/lib/legal-texts";
import { LegalContent } from "@/components/LegalContent";
import { LOCALE_META } from "@/content/locales-meta";

const ALL_INTERNAL_SLUGS: InternalDocSlug[] = [
  ...INTERNAL_DOCUMENT_SLUGS,
  ...TEAM_INTERNAL_DOCUMENT_SLUGS,
];

function resolveDoc(doc: string): InternalDocSlug | null {
  return (ALL_INTERNAL_SLUGS as string[]).includes(doc)
    ? (doc as InternalDocSlug)
    : null;
}

export default function InternalDocumentPage({
  params,
  searchParams,
}: {
  params: { doc: string };
  searchParams: { lang?: string };
}) {
  const docSlug = resolveDoc(params.doc);
  if (!docSlug) notFound();

  const lang = (
    (LOCALES as string[]).includes(searchParams.lang ?? "")
      ? searchParams.lang
      : "pl"
  ) as Locale;

  const dict = getDictionary("pl"); // UI panelu administratora jest po polsku
  const meta = dict.internalDocuments[docSlug];
  const { html, usedFallback } = getLegalHtml(lang, docSlug);

  return (
    <div>
      <Link
        href="/admin"
        className="text-sm font-semibold text-brand-textMuted transition-colors hover:text-brand-text"
      >
        ← Zgłoszenia
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-brand-textMuted">
            Bieg indywidualny
          </p>
          <div className="flex flex-wrap gap-2">
            {INTERNAL_DOCUMENT_SLUGS.map((slug) => (
              <Link
                key={slug}
                href={`/admin/documents/${slug}`}
                className={`rounded-pill border px-3 py-1 text-xs font-bold uppercase tracking-wide transition-colors ${
                  slug === docSlug
                    ? "border-brand-accent bg-brand-accentSoft text-brand-accent"
                    : "border-brand-border text-brand-textMuted hover:text-brand-text"
                }`}
              >
                {dict.internalDocuments[slug].title}
              </Link>
            ))}
          </div>
          <p className="mb-1 mt-3 text-xs font-bold uppercase tracking-wide text-brand-textMuted">
            TEAM MILE POLAND
          </p>
          <div className="flex flex-wrap gap-2">
            {TEAM_INTERNAL_DOCUMENT_SLUGS.map((slug) => (
              <Link
                key={slug}
                href={`/admin/documents/${slug}`}
                className={`rounded-pill border px-3 py-1 text-xs font-bold uppercase tracking-wide transition-colors ${
                  slug === docSlug
                    ? "border-brand-accent bg-brand-accentSoft text-brand-accent"
                    : "border-brand-border text-brand-textMuted hover:text-brand-text"
                }`}
              >
                {dict.internalDocuments[slug].title}
              </Link>
            ))}
          </div>
          <h1 className="mt-4 font-display text-3xl uppercase tracking-tight">
            {meta.title}
          </h1>
        </div>

        <nav
          aria-label="Język dokumentu"
          className="flex items-center gap-1 rounded-pill border border-brand-border bg-white/5 p-1"
        >
          {LOCALES.map((loc) => (
            <Link
              key={loc}
              href={`/admin/documents/${docSlug}?lang=${loc}`}
              className={`rounded-pill px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                loc === lang
                  ? "bg-brand-gradient text-brand-bg"
                  : "text-brand-textMuted hover:text-brand-text"
              } ${hasNativeLegalHtml(loc, docSlug) ? "" : "opacity-40"}`}
            >
              {LOCALE_META[loc].short}
            </Link>
          ))}
        </nav>
      </div>

      <p className="mt-4 rounded-xl border border-brand-error/30 bg-brand-error/10 px-4 py-3 text-sm text-brand-error">
        🔒 {meta.internalNotice}
      </p>

      <div className="mt-5 space-y-3 text-brand-textMuted">
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
    </div>
  );
}
