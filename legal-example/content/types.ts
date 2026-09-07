import type { DocumentSlug, InternalDocSlug, FieldName } from "@/lib/types";

export interface FieldConfig {
  name: FieldName;
  label: string;
  placeholder?: string;
  required: boolean;
  type: "text" | "date" | "tel" | "email" | "textarea" | "select";
  /** Opcje dla type: "select" (np. role RACER/ACE/JOKER). */
  options?: string[];
  /** Pokazuj tylko warunkowo (np. dane bankowe tylko dla laureatów nagród). */
  conditional?: "prizeWinner";
  helpText?: string;
}

export interface CheckboxConfig {
  id: string;
  label: string;
  required: boolean;
}

export interface ImageConsentConfig {
  question: string;
  agreeLabel: string;
  agreeNote: string;
  disagreeLabel: string;
  disagreeNote: string;
}

export interface DocumentContent {
  slug: DocumentSlug;
  kicker: string;
  title: string;
  eventLine: string; // wzorzec z placeholderem {event}
  intro: string[];
  highlights?: string[];
  officialDocLabel: string;
  fields: FieldConfig[];
  checkboxes: CheckboxConfig[];
  imageConsent?: ImageConsentConfig;
  submitLabel: string;
  submittingLabel: string;
  successTitle: string;
  successBody: string;
  requiredNotice: string;
}

export interface InternalDocumentMeta {
  slug: InternalDocSlug;
  kicker: string;
  title: string;
  intro: string[];
  /** Krótka notatka wyjaśniająca, dlaczego dokument NIE jest publiczny. */
  internalNotice: string;
}

export interface CommonDictionary {
  localeName: string;
  siteName: string;
  nav: {
    home: string;
    register: string;
    documents: string;
    terms: string;
    contact: string;
  };
  hub: {
    kicker: string;
    title: string;
    subtitle: string;
    cardCta: string;
  };
  eventCard: {
    label: string;
    dateLabel: string;
    venueLabel: string;
    entryLabel: string;
    entryFree: string;
    statusOpen: string;
    statusSoon: string;
    statusClosed: string;
    statusFinished: string;
    switchEvent: string;
  };
  form: {
    requiredMark: string;
    requiredHint: string;
    readFullDocument: string;
    readFullDocumentCta: string;
    fallbackNotice: string;
    errorRequired: string;
    errorGeneric: string;
    backToDocuments: string;
    backToForm: string;
    print: string;
  };
  footer: {
    rights: string;
    organizer: string;
    termsLink: string;
  };
  documents: Record<DocumentSlug, DocumentContent>;
  /**
   * Ujednolicona rejestracja — JEDEN formularz na starcie ścieżki
   * uczestnika (layout: dane uczestnika + wybór wydarzenia + wymagane
   * potwierdzenia, zgodnie z układem referencyjnym /register).
   * Skróty potwierdzeń odsyłają do pełnych tekstów trzech dokumentów
   * (`documents.oswiadczenie/przepisy/rodo`) zamiast je dosłownie
   * powtarzać — stąd osobna, węższa struktura zamiast pełnego
   * DocumentContent.
   */
  register: DocumentContent;
  /**
   * Ujednolicona rejestracja dla wydarzeń typu "team" (TEAM MILE POLAND) —
   * ten sam wzorzec co `register`, ale z polami i skróconymi
   * potwierdzeniami odpowiednimi dla formatu drużynowo-indywidualnego
   * (nazwa drużyny, rola RACER/ACE/JOKER, dokumenty: Oświadczenie,
   * Regulamin, Zasady, Klauzula RODO dla tej serii).
   */
  registerTeam: DocumentContent;
  internalDocuments: Record<InternalDocSlug, InternalDocumentMeta>;
}
