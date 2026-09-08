import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "@/app/series-flows.css";
// The same stylesheet the event-scoped preview and the admin statement print
// use, imported by alias exactly as `admin/.../statements/print/page.tsx` does.
// `.legal-prose` typography, the `.legal-card` / `.legal-scroll` frame and the
// print rules are one vocabulary across all three surfaces; a second copy of it
// here would be a second thing to keep in step with the corpus' HTML.
import "@/app/[locale]/events/[slug]/legal/legal.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { Link } from "@/i18n/navigation";
import { locales } from "@/lib/i18n/config";
import { loadLegalDoc } from "@/lib/legal/content";
import { type DocLocale, getEventlessDocs, type LegalDoc } from "@/lib/legal/manifest";

/**
 * The event-independent legal route: `/[locale]/legal/[doc]`.
 *
 * Every other legal URL hangs off an event slug, because most of the corpus is
 * *about* one race night — the Statement prints its date and the reader's own
 * details into the text. The team Rules, the team Regulations and the four
 * read-only appendices are not: they are the standing terms of TEAM MILE POLAND,
 * identical whichever night a team eventually enters. A manager forming a team
 * has to be able to read them **before** any team event exists, and there is no
 * slug to hang them off, so they get their own URL.
 *
 * What may be served here is not a judgement made in this file: it is the
 * manifest's `eventless` flag, and `src/lib/legal/check.ts` fails the build if a
 * flagged document still contains a fill token. That is what lets this page pass
 * no tokens at all — there is no event date to pass and no consent record to
 * pass one from, so a token reaching a reader here would be an unfillable hole
 * rather than a visible blank waiting for a signature.
 *
 * Public, no auth gate, like the event-scoped route (PRD cross-cutting decision
 * 2). No `revalidate`: the bytes come from the repository and change only with a
 * deploy, so unlike the event route there is nothing a database edit could make
 * stale.
 */

/**
 * Eventless documents × locales. The locale half comes from the parent — the
 * `[locale]` layout's own `generateStaticParams` — so this returns the `doc`
 * segment only and Next fans it out over pl/en/ua.
 *
 * `dynamicParams` is left at its default `true` deliberately, matching the event
 * route: an unprerendered path still reaches the handler, and the `notFound()`
 * below is what rejects a non-eventless slug. Nothing here depends on the flag
 * list being frozen at build time.
 */
export function generateStaticParams() {
  return getEventlessDocs().map((doc) => ({ doc: doc.slug }));
}

type PageProps = { params: Promise<{ locale: string; doc: string }> };

/**
 * The document a request names, or `null` if it has no page here.
 *
 * Deliberately narrower than `getLegalDoc`: an unflagged slug 404s rather than
 * rendering. Serving the team Statement or an individual-set document from a URL
 * with no event in it would present terms that only ever apply to one race night
 * as though they stood on their own.
 */
function resolveEventlessDoc(docSlug: string): LegalDoc | null {
  return getEventlessDocs().find((d) => d.slug === docSlug) ?? null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, doc: docSlug } = await params;
  const doc = resolveEventlessDoc(docSlug);
  if (!doc) notFound();
  const t = await getTranslations({ locale, namespace: "legal" });
  return { title: t(`docs.${doc.slug}`) };
}

export default async function EventlessLegalDocumentPage({ params }: PageProps) {
  const { locale, doc: docSlug } = await params;
  setRequestLocale(locale);

  const doc = resolveEventlessDoc(docSlug);
  if (!doc) notFound();

  const t = await getTranslations("legal");
  const readerLocale = (locales as readonly string[]).includes(locale)
    ? (locale as DocLocale)
    : "pl";

  // A signable eventless document is registered in all three locales (the build
  // guard sees to it), so the fallback arm can only fire for a read-only
  // appendix — and then the notice below says so.
  const { html, lang, usedFallback } = loadLegalDoc(doc, readerLocale);

  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap">
          <Link href="/" className="detail-back no-print">
            {t("backHome")}
          </Link>

          <header className="legal-head no-print">
            <span className="iv-eyebrow">{t("eyebrow")}</span>
            <h1 className="iv-title">{t(`docs.${doc.slug}`)}</h1>
            <p className="legal-doc-meta">{t("versionMeta", { version: doc.version })}</p>
          </header>

          <div className="print-area">
            {usedFallback && (
              <p className="legal-notice legal-notice--fallback">{t("fallbackNotice")}</p>
            )}
            {/* No `previewNotice`: an eventless document has no blanks to
                explain. The build guard is what makes that true, so this is not
                an assumption the page is making on its own. */}
            <div className="legal-card">
              <div className="legal-scroll">
                {/* Trusted repository content: pandoc output from the approved
                    `.docx`, hashed in the manifest and guarded by the build.
                    Nothing is substituted into it at all — see `fillLegalTokens`
                    on the event-scoped route, which this page has no use for. */}
                <div
                  className="legal-prose"
                  lang={lang === "ua" ? "uk" : lang}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
