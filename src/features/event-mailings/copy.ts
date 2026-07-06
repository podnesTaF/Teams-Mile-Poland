import type { EventScheduledKind } from "./schedule";

export type MailLocale = "ua" | "pl" | "en";

export type EventMailAction = "calendar" | "ticket" | "map";

export type EventMailContent = {
  preview: string;
  eyebrow: string;
  title: string;
  greeting: string;
  intro: string;
  bullets?: string[];
  outro?: string;
  showWhenWhere: boolean;
  actions: EventMailAction[];
};

export function asMailLocale(value: string): MailLocale {
  return value === "pl" || value === "en" || value === "ua" ? value : "pl";
}

function firstName(full: string) {
  return full.trim().split(/\s+/)[0] || full;
}

const GREETING: Record<MailLocale, (name: string) => string> = {
  ua: (n) => `Привіт, ${n}!`,
  pl: (n) => `Cześć, ${n}!`,
  en: (n) => `Hi ${n}!`,
};

/** Button labels + when/where field labels per locale (values passed in). */
export const UI: Record<
  MailLocale,
  {
    calendar: string;
    ticket: string;
    map: string;
    whenWhere: string;
    dateLabel: string;
    timeLabel: string;
    venueLabel: string;
    contactLabel: string;
  }
> = {
  ua: {
    calendar: "Додати в Google Календар",
    ticket: "Відкрити мій квиток",
    map: "Відкрити маршрут",
    whenWhere: "Коли і де",
    dateLabel: "Дата",
    timeLabel: "Час",
    venueLabel: "Локація",
    contactLabel: "Контакти організаторів",
  },
  pl: {
    calendar: "Dodaj do Kalendarza Google",
    ticket: "Otwórz mój bilet",
    map: "Otwórz trasę",
    whenWhere: "Kiedy i gdzie",
    dateLabel: "Data",
    timeLabel: "Godziny",
    venueLabel: "Lokalizacja",
    contactLabel: "Kontakt z organizatorami",
  },
  en: {
    calendar: "Add to Google Calendar",
    ticket: "Open my ticket",
    map: "Open route",
    whenWhere: "When & where",
    dateLabel: "Date",
    timeLabel: "Time",
    venueLabel: "Venue",
    contactLabel: "Organizer contacts",
  },
};

type Builder = (locale: MailLocale) => Omit<EventMailContent, "greeting">;

const BUILDERS: Record<EventScheduledKind, Builder> = {
  reminder_7d: (locale) =>
    ({
      ua: {
        preview: "Твоя миля — за тиждень",
        eyebrow: "За 7 днів",
        title: "Організаційна інформація",
        intro: "До твого забігу на милю лишається тиждень. Ось що варто знати заздалегідь.",
        bullets: [
          "Реєстрація та видача номерів — на місці",
          "Візьми спортивний одяг і зручне взуття",
          "Телефон із QR-кодом квитка",
        ],
        showWhenWhere: true,
        actions: ["calendar"] as EventMailAction[],
      },
      pl: {
        preview: "Twoja mila — za tydzień",
        eyebrow: "Za 7 dni",
        title: "Informacje organizacyjne",
        intro: "Do Twojego biegu na milę został tydzień. Oto co warto wiedzieć z wyprzedzeniem.",
        bullets: [
          "Rejestracja i wydawanie numerów — na miejscu",
          "Zabierz strój i wygodne obuwie",
          "Telefon z kodem QR biletu",
        ],
        showWhenWhere: true,
        actions: ["calendar"] as EventMailAction[],
      },
      en: {
        preview: "Your mile — one week to go",
        eyebrow: "7 days to go",
        title: "Event logistics",
        intro: "One week until your mile. Here's what's good to know in advance.",
        bullets: [
          "Check-in & bib pickup — on site",
          "Bring sportswear and comfortable shoes",
          "Phone with your QR ticket",
        ],
        showWhenWhere: true,
        actions: ["calendar"] as EventMailAction[],
      },
    })[locale],

  reminder_3d: (locale) =>
    ({
      ua: {
        preview: "За 3 дні — твоя миля",
        eyebrow: "За 3 дні",
        title: "Скоро побачимося на старті",
        intro: "Лишилося зовсім трохи. Приїзди заздалегідь, щоб спокійно пройти реєстрацію та отримати номер.",
        bullets: ["Приїхати за 30–40 хв до старту", "QR-квиток у телефоні", "Спортивна форма 🔥"],
        showWhenWhere: true,
        actions: ["calendar"] as EventMailAction[],
      },
      pl: {
        preview: "Za 3 dni — Twoja mila",
        eyebrow: "Za 3 dni",
        title: "Niedługo widzimy się na starcie",
        intro: "Zostało niewiele. Przyjedź wcześniej, aby spokojnie przejść rejestrację i odebrać numer.",
        bullets: ["Przyjedź 30–40 min przed startem", "Bilet QR w telefonie", "Strój sportowy 🔥"],
        showWhenWhere: true,
        actions: ["calendar"] as EventMailAction[],
      },
      en: {
        preview: "3 days until your mile",
        eyebrow: "3 days to go",
        title: "See you at the start line soon",
        intro: "Almost there. Come a little early to check in and collect your bib without a rush.",
        bullets: ["Arrive 30–40 min before the start", "QR ticket on your phone", "Sportswear 🔥"],
        showWhenWhere: true,
        actions: ["calendar"] as EventMailAction[],
      },
    })[locale],

  reminder_1d: (locale) =>
    ({
      ua: {
        preview: "Завтра — твоя миля",
        eyebrow: "Завтра",
        title: "Завтра — старт!",
        intro: "Практична інформація на завтра. Покажи QR-квиток на вході — і вперед.",
        bullets: ["Приходь за розкладом", "Май квиток напоготові у телефоні"],
        outro: "Питання? Телефонуй організаторам.",
        showWhenWhere: true,
        actions: ["ticket", "map"] as EventMailAction[],
      },
      pl: {
        preview: "Jutro — Twoja mila",
        eyebrow: "Jutro",
        title: "Jutro start!",
        intro: "Praktyczne informacje na jutro. Pokaż bilet QR przy wejściu — i działamy.",
        bullets: ["Przyjdź zgodnie z harmonogramem", "Miej bilet gotowy w telefonie"],
        outro: "Pytania? Zadzwoń do organizatorów.",
        showWhenWhere: true,
        actions: ["ticket", "map"] as EventMailAction[],
      },
      en: {
        preview: "Tomorrow — your mile",
        eyebrow: "Tomorrow",
        title: "Tomorrow is race day!",
        intro: "Practical info for tomorrow. Show your QR ticket at the entrance and you're in.",
        bullets: ["Come per the schedule", "Keep your ticket ready on your phone"],
        outro: "Questions? Call the organizers.",
        showWhenWhere: true,
        actions: ["ticket", "map"] as EventMailAction[],
      },
    })[locale],

  morning: (locale) =>
    ({
      ua: {
        preview: "Сьогодні — твоя миля",
        eyebrow: "Сьогодні",
        title: "Сьогодні твій забіг",
        intro: "Покажи QR-квиток на вході. Номер отримаєш на реєстрації. До зустрічі на старті!",
        showWhenWhere: true,
        actions: ["ticket", "map"] as EventMailAction[],
      },
      pl: {
        preview: "Dziś — Twoja mila",
        eyebrow: "Dziś",
        title: "Dziś Twój bieg",
        intro: "Pokaż bilet QR przy wejściu. Numer odbierzesz przy rejestracji. Do zobaczenia na starcie!",
        showWhenWhere: true,
        actions: ["ticket", "map"] as EventMailAction[],
      },
      en: {
        preview: "Today is your mile",
        eyebrow: "Today",
        title: "Today is your race",
        intro: "Show your QR ticket at the entrance. Pick up your bib at check-in. See you at the start!",
        showWhenWhere: true,
        actions: ["ticket", "map"] as EventMailAction[],
      },
    })[locale],
};

export function eventMailContent(
  kind: EventScheduledKind,
  locale: MailLocale,
  fullName: string,
): EventMailContent {
  return { greeting: GREETING[locale](firstName(fullName)), ...BUILDERS[kind](locale) };
}
