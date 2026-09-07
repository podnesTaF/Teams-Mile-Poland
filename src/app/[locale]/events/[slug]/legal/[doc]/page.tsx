import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "@/app/series-flows.css";
import "../legal.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { Link } from "@/i18n/navigation";
import { getEventBySlug } from "@/lib/events/registry";
// Straight from the store, not the `registry` compat shim: `getAllEvents` and
// `isPubliclyVisible` are new API, and the shim exists only so the pre-DB call
// sites kept compiling.
import { getAllEvents, isPubliclyVisible } from "@/lib/events/store";
import { formatEventLongDate } from "@/lib/events/time";
import type { EventSummary } from "@/lib/events/types";
import { locales } from "@/lib/i18n/config";
import { loadLegalDoc } from "@/lib/legal/content";
import { fillLegalTokens } from "@/lib/legal/fill";
import {
  type DocLocale,
  docSetForEventType,
  getLegalDoc,
  getSignableDocs,
  type LegalDoc,
} from "@/lib/legal/manifest";

/**
 * The public, unsigned preview of one legal document for one event.
 *
 * User stories 1–5: read the whole Statement, the Rules or the GDPR clause at
 * their own URL, in your own language, with *this* event's date printed into the
 * text and every personal field visibly blank so it is obvious nothing has been
 * accepted yet. The consent flow that fills those fields is #53; the personalised
 * print of a signed Statement is #54. Both reuse `fillLegalTokens` from here.
 *
 * Public — no auth gate (PRD cross-cutting decision 2). A `draft` event 404s
 * like every other public surface; `completed` and `cancelled` events keep their
 * documents, because the text someone accepted stays readable after the night is
 * over or called off.
 */

/**
 * Safety-net ISR on top of `revalidateEventSurfaces`, which now invalidates this
 * route: a date correction made straight in the database reaches no revalidation
 * and would leave the wrong day printed inside a legal document. Five minutes
 * bounds that. Must stay a literal — the value is statically analyzed.
 */
export const revalidate = 300;

/**
 * Events × their set's signable documents. `dynamicParams` is left at its default
 * `true`, so an event created after the last deploy renders on first request.
 *
 * Drafts are filtered out, exactly as on the event detail page: prerendering one
 * would publish the slug — and with it the night's existence — the moment it was
 * created. The page repeats the check, because `dynamicParams` means a
 * non-prerendered slug still reaches the handler.
 *
 * Only *signable* documents get paths. The read-only appendices are registered
 * and render fine at this route, but they belong to the team corpus and nothing
 * links to them yet, so prerendering four extra documents per team event per
 * locale buys nothing; they render on first request like any other unprerendered
 * path.
 */
export async function generateStaticParams() {
  const events = (await getAllEvents()).filter(isPubliclyVisible);
  return events.flatMap((event) =>
    getSignableDocs(docSetForEventType(event.eventType)).map((doc) => ({
      slug: event.slug,
      doc: doc.slug,
    })),
  );
}

type PageProps = { params: Promise<{ locale: string; slug: string; doc: string }> };

/** The event and document a request names, or `null` if either has no page. */
async function resolve(
  slug: string,
  docSlug: string,
): Promise<{ event: EventSummary; doc: LegalDoc } | null> {
  const event = await getEventBySlug(slug);
  if (!event || !isPubliclyVisible(event)) return null;
  const doc = getLegalDoc(docSlug);
  if (!doc) return null;
  // An individual event serves the individual corpus and nothing else. Without
  // this an individual night would happily render the TEAM MILE Statement at its
  // own URL, which reads as though those terms applied to it.
  if (doc.set !== docSetForEventType(event.eventType)) return null;
  return { event, doc };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug, doc: docSlug } = await params;
  const resolved = await resolve(slug, docSlug);
  if (!resolved) notFound();
  const t = await getTranslations({ locale, namespace: "legal" });
  return { title: `${t(`docs.${resolved.doc.slug}`)} — ${resolved.event.name}` };
}

export default async function LegalDocumentPage({ params }: PageProps) {
  const { locale, slug, doc: docSlug } = await params;
  setRequestLocale(locale);

  const resolved = await resolve(slug, docSlug);
  if (!resolved) notFound();
  const { event, doc } = resolved;

  const t = await getTranslations("legal");
  const readerLocale = (locales as readonly string[]).includes(locale)
    ? (locale as DocLocale)
    : "pl";

  const { html: source, lang, usedFallback } = loadLegalDoc(doc, readerLocale);
  // The document is read in the reader's language but dated in it too, so the
  // event date is spelled in the language of the *bytes* rather than the URL —
  // a Polish fallback document must not carry a Ukrainian month name.
  //
  // Everything else is left unset on purpose: `__SIGN_DATE__`, `__FULL_NAME__`,
  // `__BIRTH_DATE__`, `__PHONE_EMAIL__`, `__ADDRESS__`, `__EMERGENCY_CONTACT__`
  // and `__SIGNATURE_BLOCK__` all render as `.fill-blank` ruled gaps, which is
  // what tells a reader this copy is unsigned.
  const html = fillLegalTokens(source, {
    eventDate: formatEventLongDate(lang, event.date),
  });

  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap">
          <Link href={`/events/${slug}`} className="detail-back no-print">
            {t("back")}
          </Link>

          <header className="legal-head no-print">
            <span className="iv-eyebrow">{event.name}</span>
            <h1 className="iv-title">{t(`docs.${doc.slug}`)}</h1>
            <p className="legal-doc-meta">
              {t("meta", {
                event: formatEventLongDate(locale, event.date),
                version: doc.version,
              })}
            </p>
          </header>

          <div className="print-area">
            {/* Both notices are the reader's explanation for something visibly
                odd in the text below, so they sit above it. */}
            <p className="legal-notice">{t("previewNotice")}</p>
            {usedFallback && (
              <p className="legal-notice legal-notice--fallback">{t("fallbackNotice")}</p>
            )}
            <div className="legal-card">
              <div className="legal-scroll">
                {/* Trusted repository content: pandoc output from the approved
                    `.docx`, hashed in the manifest and guarded by the build.
                    Nothing user-supplied reaches this string — the only value
                    substituted here is the event's own date. */}
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
