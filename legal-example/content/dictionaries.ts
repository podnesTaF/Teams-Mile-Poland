import type { DocumentSlug, EventType, Locale } from "@/lib/types";
import { LOCALES, DEFAULT_LOCALE } from "@/lib/types";
import type { CommonDictionary, DocumentContent } from "./types";
import { pl } from "./i18n/pl";
import { en } from "./i18n/en";
import { ru } from "./i18n/ru";
import { ua } from "./i18n/ua";

const DICTIONARIES: Record<Locale, CommonDictionary> = { pl, en, ua, ru };

export function isLocale(value: string): value is Locale {
  return (LOCALES as string[]).includes(value);
}

export function getDictionary(locale: string): CommonDictionary {
  return DICTIONARIES[isLocale(locale) ? locale : DEFAULT_LOCALE];
}

export function getDocumentContent(
  locale: string,
  doc: DocumentSlug,
): DocumentContent {
  return getDictionary(locale).documents[doc];
}

/**
 * Zwraca konfigurację ujednoliconej rejestracji odpowiednią dla rodzaju
 * wydarzenia — `register` dla "individual", `registerTeam` dla "team".
 * Dla "tournament"/"league" (brak jeszcze treści) zwracamy `register`
 * jako bezpieczny fallback.
 */
export function getRegisterContent(
  locale: string,
  eventType: EventType,
): DocumentContent {
  const dict = getDictionary(locale);
  return eventType === "team" ? dict.registerTeam : dict.register;
}

/**
 * Zwraca tytuł dla dowolnego docSlug zapisanego w magazynie zgłoszeń —
 * w tym pseudo-sluga "registration" (ujednolicony formularz /register,
 * patrz app/api/register/route.ts), który nie jest częścią DocumentSlug.
 * Dla "registration" trzeba dodatkowo podać `eventType` zgłoszenia, żeby
 * pokazać właściwy tytuł (indywidualny vs drużynowy formularz).
 */
export function getAnyDocumentTitle(
  locale: string,
  docSlug: string,
  eventType?: EventType,
): string {
  const dict = getDictionary(locale);
  if (docSlug === "registration") {
    return getRegisterContent(locale, eventType ?? "individual").title;
  }
  if ((docSlug as DocumentSlug) in dict.documents) {
    return dict.documents[docSlug as DocumentSlug].title;
  }
  if (docSlug in dict.internalDocuments) {
    const meta = (
      dict.internalDocuments as Record<string, { title: string }>
    )[docSlug];
    return meta?.title ?? docSlug;
  }
  return docSlug;
}

export { LOCALES, DEFAULT_LOCALE };
