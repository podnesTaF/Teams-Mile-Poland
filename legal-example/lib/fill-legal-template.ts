import type { Locale } from "./types";
import { LOCALE_META } from "@/content/locales-meta";

/**
 * Wypełnianie treści dokumentów (content/legal-texts/*.html) prawdziwymi
 * danymi: datą wybranego wydarzenia, datą faktycznego podpisania oraz
 * danymi uczestnika. Pliki HTML zawierają tokeny (np. __EVENT_DATE__,
 * __FULL_NAME__) wstawione ręcznie w miejscach, gdzie w oryginalnych
 * dokumentach .docx były linie do wypełnienia lub sztywno wpisana data
 * jednej edycji (29.08.2026).
 *
 * Dwa tryby użycia:
 *  - PODGLĄD PRZED PODPISANIEM (`/documents/[doc]/read`): znamy tylko
 *    wybrane wydarzenie -> __EVENT_DATE__ wypełnione, pola uczestnika i
 *    __SIGN_DATE__ pokazują pustą linię (jeszcze nic nie podpisano).
 *  - DOKUMENT PODPISANY (panel administratora): wszystkie tokeny
 *    wypełnione prawdziwymi danymi z zgłoszenia.
 *
 * STREFA CZASOWA: wydarzenia odbywają się w Polsce, więc WSZYSTKIE daty
 * wyświetlane uczestnikowi i administratorowi są liczone w strefie
 * Europe/Warsaw — jawnie, niezależnie od tego, w jakiej strefie czasowej
 * fizycznie działa serwer (np. hosting w USA/UTC pokazywałby inny dzień
 * kalendarzowy dla godzin nocnych bez tego jawnego ustawienia).
 */

const TIME_ZONE = "Europe/Warsaw";

export interface FillTokens {
  /** Sformatowana data wydarzenia, np. "29 sierpnia 2026". */
  eventDate?: string;
  /** Sformatowana faktyczna data podpisania (dnia wysłania formularza, czas polski). */
  signDate?: string;
  fullName?: string;
  birthDate?: string;
  phoneEmail?: string;
  address?: string;
  emergencyContact?: string;
}

/**
 * Format „dzień, miesiąc słownie, rok” dla PROSTEJ daty kalendarzowej
 * (np. data wydarzenia "2026-08-01", bez komponentu czasu/strefy).
 * Jawnie wymuszamy timeZone: "Europe/Warsaw", żeby wynik był identyczny
 * niezależnie od strefy czasowej serwera.
 */
export function formatSpelledDate(iso: string, locale: Locale): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat(LOCALE_META[locale].htmlLang, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(date);
}

/**
 * Format „dzień, miesiąc słownie, rok” dla PEŁNEGO znacznika czasu ISO
 * z konkretną chwilą w czasie (np. `receivedAt` zapisu zgłoszenia —
 * "2026-08-27T23:51:34.000Z"). W przeciwieństwie do wcześniejszej wersji
 * kodu NIE obcinamy stringa do 10 znaków (to gubiło informację o strefie
 * i psuło datę przy zgłoszeniach złożonych w nocy) — od razu konwertujemy
 * całą chwilę czasową na kalendarzową datę w Warszawie.
 */
export function formatSpelledDateFromInstant(
  isoInstant: string,
  locale: Locale,
): string {
  const date = new Date(isoInstant);
  return new Intl.DateTimeFormat(LOCALE_META[locale].htmlLang, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(date);
}

/** Data + godzina po polsku, do wyświetlenia administratorowi (np. "Przesłano"). */
export function formatDateTimeWarsaw(isoInstant: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "long",
    timeStyle: "medium",
    timeZone: TIME_ZONE,
  }).format(new Date(isoInstant));
}

const BLANK_PLACEHOLDER = '<span class="fill-blank">&nbsp;</span>';

export function fillLegalTemplate(
  html: string,
  locale: Locale,
  tokens: FillTokens,
): string {
  const replacements: Record<string, string> = {
    __EVENT_DATE__: tokens.eventDate ?? BLANK_PLACEHOLDER,
    __SIGN_DATE__: tokens.signDate ?? BLANK_PLACEHOLDER,
    __FULL_NAME__: tokens.fullName || BLANK_PLACEHOLDER,
    __BIRTH_DATE__: tokens.birthDate || BLANK_PLACEHOLDER,
    __PHONE_EMAIL__: tokens.phoneEmail || BLANK_PLACEHOLDER,
    __ADDRESS__: tokens.address || BLANK_PLACEHOLDER,
    __EMERGENCY_CONTACT__: tokens.emergencyContact || BLANK_PLACEHOLDER,
  };

  let out = html;
  for (const [token, value] of Object.entries(replacements)) {
    out = out.split(token).join(value);
  }
  return out;
}
