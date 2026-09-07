import type { Locale } from "@/lib/types";

/**
 * Etykiety WEWNĄTRZ obszaru wydruku (.print-area) na stronach
 * /admin/submissions/[id] i /admin/submissions/print — czyli tekst, który
 * faktycznie trafia na wydrukowany/zapisany PDF dokument. To musi być w
 * JĘZYKU ZGŁOSZENIA (submission.locale), a nie po polsku na sztywno —
 * inaczej uczestnik, który wypełniał formularz po angielsku/ukraińsku/
 * rosyjsku, dostaje wydrukowany dokument z polskimi podpisami dookoła
 * swojego (poprawnie przetłumaczonego) tekstu prawnego.
 *
 * Reszta panelu administratora (nawigacja, tabela zgłoszeń, przyciski)
 * celowo zostaje wyłącznie po polsku — to interfejs dla personelu, nie
 * część dokumentu — patrz README.md, sekcja „Język panelu administratora”.
 */
export interface PrintLabelSet {
  signedElectronically: string;
  participantFallbackName: string;
  signDateLabel: string;
  ipAddressLabel: string;
  participantDataHeading: string;
  confirmedConsentsHeading: string;
  imageConsentNotChosen: string;
  fullDocumentTextHeading: (title: string) => string;
}

export const PRINT_LABELS: Record<Locale, PrintLabelSet> = {
  pl: {
    signedElectronically: "ACE BATTLE RUN Polska — dokumenty podpisane elektronicznie",
    participantFallbackName: "Uczestnik",
    signDateLabel: "Data podpisania",
    ipAddressLabel: "adres IP",
    participantDataHeading: "Dane uczestnika",
    confirmedConsentsHeading: "Potwierdzone zgody",
    imageConsentNotChosen: "— nie wybrano —",
    fullDocumentTextHeading: (title) => `Pełny tekst dokumentu: ${title}`,
  },
  en: {
    signedElectronically: "ACE BATTLE RUN Poland — electronically signed documents",
    participantFallbackName: "Participant",
    signDateLabel: "Date signed",
    ipAddressLabel: "IP address",
    participantDataHeading: "Participant details",
    confirmedConsentsHeading: "Confirmed consents",
    imageConsentNotChosen: "— not selected —",
    fullDocumentTextHeading: (title) => `Full text of the document: ${title}`,
  },
  ru: {
    signedElectronically: "ACE BATTLE RUN Польша — документы, подписанные в электронном виде",
    participantFallbackName: "Участник",
    signDateLabel: "Дата подписания",
    ipAddressLabel: "IP-адрес",
    participantDataHeading: "Данные участника",
    confirmedConsentsHeading: "Подтверждённые согласия",
    imageConsentNotChosen: "— не выбрано —",
    fullDocumentTextHeading: (title) => `Полный текст документа: ${title}`,
  },
  ua: {
    signedElectronically: "ACE BATTLE RUN Польща — документи, підписані в електронному вигляді",
    participantFallbackName: "Учасник",
    signDateLabel: "Дата підписання",
    ipAddressLabel: "IP-адреса",
    participantDataHeading: "Дані учасника",
    confirmedConsentsHeading: "Підтверджені згоди",
    imageConsentNotChosen: "— не обрано —",
    fullDocumentTextHeading: (title) => `Повний текст документа: ${title}`,
  },
};
