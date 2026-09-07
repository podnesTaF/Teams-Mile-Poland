import type { Metadata } from "next";
import Link from "next/link";
import {
  LOCALES,
  DOCUMENT_SLUGS_BY_EVENT_TYPE,
  PUBLIC_APPENDIX_SLUGS,
  EVENT_TYPES,
  type Locale,
  type EventType,
} from "@/lib/types";
import { getDictionary, getRegisterContent } from "@/content/dictionaries";
import { listEvents, getNextOpenEvent, getNextOpenEventOfType } from "@/lib/events";
import { Container } from "@/components/Container";
import { DocumentCard } from "@/components/DocumentCard";
import { AppendixCard } from "@/components/AppendixCard";
import { LOCALE_META } from "@/content/locales-meta";

const ADDITIONAL_DOCS_HEADING: Record<Locale, string> = {
  pl: "Dokumenty dodatkowe (do wglądu)",
  en: "Additional documents (for review)",
  ua: "Додаткові документи (для ознайомлення)",
  ru: "Дополнительные документы (для ознакомления)",
};
const ADDITIONAL_DOCS_SUBTITLE: Record<Locale, string> = {
  pl: "Załączniki do Regulaminu Publicznego — harmonogramy, kategorie i pula nagród oraz kryteria rankingowe. Do przeczytania, bez podpisu.",
  en: "Appendices to the Public Regulations — schedules, categories and prize pool, and ranking criteria. For reading only, no signature required.",
  ua: "Додатки до Регламенту — розклади, категорії та призовий фонд, критерії рейтингу. Лише для читання, підпис не потрібен.",
  ru: "Приложения к Регламенту — расписания, категории и призовой фонд, критерии рейтинга. Только для чтения, подпись не требуется.",
};
const READ_LABEL: Record<Locale, string> = {
  pl: "Otwórz",
  en: "Open",
  ua: "Відкрити",
  ru: "Открыть",
};

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export function generateMetadata({
  params,
}: {
  params: { lang: string };
}): Metadata {
  const dict = getDictionary(params.lang);
  return { title: `${dict.hub.title} — ${dict.siteName}` };
}

const LABELS_REQUIRED: Record<Locale, string> = {
  pl: "Wymagany",
  en: "Required",
  ua: "Обов'язковий",
  ru: "Обязательный",
};
const LABELS_OPTIONAL: Record<Locale, string> = {
  pl: "Opcjonalny",
  en: "Optional",
  ua: "Опційний",
  ru: "Опциональный",
};

/** Etykiety zakładek rodzaju wydarzenia — "tournament"/"league" oznaczone jako "wkrótce", bo nie mają jeszcze własnych dokumentów. */
const EVENT_TYPE_LABELS: Record<EventType, Record<Locale, string>> = {
  individual: {
    pl: "Bieg indywidualny",
    en: "Individual race",
    ua: "Індивідуальний забіг",
    ru: "Индивидуальный забег",
  },
  team: {
    pl: "TEAM MILE (drużynowy)",
    en: "TEAM MILE (team)",
    ua: "TEAM MILE (командний)",
    ru: "TEAM MILE (командный)",
  },
  tournament: {
    pl: "Turniej (wkrótce)",
    en: "Tournament (soon)",
    ua: "Турнір (незабаром)",
    ru: "Турнир (скоро)",
  },
  league: {
    pl: "Liga (wkrótce)",
    en: "League (soon)",
    ua: "Ліга (незабаром)",
    ru: "Лига (скоро)",
  },
};

export default function DocumentsHubPage({
  params,
  searchParams,
}: {
  params: { lang: string };
  searchParams: { event?: string; type?: string };
}) {
  const locale = (
    (LOCALES as string[]).includes(params.lang) ? params.lang : "pl"
  ) as Locale;
  const dict = getDictionary(locale);
  const events = listEvents();

  const requestedEvent = events.find((e) => e.id === searchParams.event);
  const requestedType = (EVENT_TYPES as string[]).includes(
    searchParams.type ?? "",
  )
    ? (searchParams.type as EventType)
    : undefined;

  const event =
    requestedEvent ??
    (requestedType ? getNextOpenEventOfType(requestedType) : undefined) ??
    getNextOpenEvent();

  const docSlugs = DOCUMENT_SLUGS_BY_EVENT_TYPE[event.eventType];
  const registerContent = getRegisterContent(locale, event.eventType);

  const availableTypes = EVENT_TYPES.filter((t) =>
    events.some((e) => e.eventType === t),
  );

  return (
    <Container>
      <span className="eyebrow">{dict.hub.kicker}</span>
      <h1 className="mt-3 max-w-2xl font-display text-4xl leading-[1.05] sm:text-5xl">
        {dict.hub.title}
      </h1>
      <p className="mt-4 max-w-xl text-brand-textMuted">{dict.hub.subtitle}</p>

      {/* Zakładki rodzaju wydarzenia — pokazujemy tylko te, dla których
          istnieje choć jedno wydarzenie w bazie (patrz lib/events.ts). */}
      {availableTypes.length > 1 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {availableTypes.map((t) => {
            const eventOfType =
              getNextOpenEventOfType(t) ?? events.find((e) => e.eventType === t);
            const active = event.eventType === t;
            return (
              <Link
                key={t}
                href={`/${locale}?type=${t}${eventOfType ? `&event=${eventOfType.id}` : ""}`}
                className={`rounded-pill border px-4 py-2 text-sm font-bold uppercase tracking-wide transition-colors ${
                  active
                    ? "border-brand-accent bg-brand-accentSoft text-brand-accent"
                    : "border-brand-border text-brand-textMuted hover:text-brand-text"
                }`}
              >
                {EVENT_TYPE_LABELS[t][locale]}
              </Link>
            );
          })}
        </div>
      )}

      <Link
        href={`/${locale}/register?event=${event.id}`}
        className="btn-primary mt-6 w-fit"
      >
        {registerContent.title} →
      </Link>

      {docSlugs.length === 0 ? (
        <p className="mt-10 text-brand-textMuted">
          {locale === "pl"
            ? "Dokumenty dla tego formatu zostaną opublikowane wkrótce."
            : locale === "en"
              ? "Documents for this format will be published soon."
              : locale === "ru"
                ? "Документы для этого формата будут опубликованы позже."
                : "Документи для цього формату будуть опубліковані незабаром."}
        </p>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {docSlugs.map((slug) => {
            const doc = dict.documents[slug];
            return (
              <DocumentCard
                key={slug}
                href={`/${locale}/documents/${slug}/read?event=${event.id}`}
                doc={doc}
                cta={dict.hub.cardCta}
                requiredLabel={LABELS_REQUIRED[locale]}
                optionalLabel={LABELS_OPTIONAL[locale]}
              />
            );
          })}
        </div>
      )}

      <p className="mt-10 text-xs text-brand-textMuted">
        {LOCALE_META[locale].label} · {dict.form.requiredMark}
      </p>

      {/* Załączniki 1–5 — wyłącznie dla serii "team" (TEAM MILE POLAND).
          Czysto referencyjne: bez zgody/podpisu, tylko do przeczytania. */}
      {event.eventType === "team" && (
        <div className="mt-14 border-t border-brand-border pt-10">
          <h2 className="font-display text-2xl leading-tight sm:text-3xl">
            {ADDITIONAL_DOCS_HEADING[locale]}
          </h2>
          <p className="mt-2 max-w-xl text-brand-textMuted">
            {ADDITIONAL_DOCS_SUBTITLE[locale]}
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PUBLIC_APPENDIX_SLUGS.map((slug) => (
              <AppendixCard
                key={slug}
                href={`/${locale}/appendix/${slug}?event=${event.id}`}
                doc={dict.internalDocuments[slug]}
                label={READ_LABEL[locale]}
              />
            ))}
          </div>
        </div>
      )}
    </Container>
  );
}
