import { EVENT } from "@/lib/marketing/event";

export type MailLocale = "ua" | "pl" | "en";

export type LifecycleKind =
  | "reminder_14d"
  | "reminder_7d"
  | "reminder_3d"
  | "reminder_1d"
  | "morning"
  | "captain_incomplete";

export type LifecycleAction = "calendar" | "ticket" | "map" | "invite";

export type LifecycleContent = {
  preview: string;
  eyebrow: string;
  title: string;
  greeting: string;
  intro: string;
  bullets?: string[];
  outro?: string;
  showWhenWhere: boolean;
  actions: LifecycleAction[];
};

export type LifecycleCtx = {
  fullName: string;
  teamName?: string | null;
  remaining?: number;
};

function firstName(full: string) {
  return full.trim().split(/\s+/)[0] || full;
}

/** Shared chrome strings (button labels + when/where block) per locale. */
export const UI: Record<
  MailLocale,
  {
    calendar: string;
    ticket: string;
    map: string;
    invite: string;
    whenWhere: string;
    dateLabel: string;
    timeLabel: string;
    venueLabel: string;
    contactLabel: string;
    dateValue: string;
    timeValue: string;
    venueValue: string;
  }
> = {
  ua: {
    calendar: "Додати в Google Календар",
    ticket: "Відкрити мій квиток",
    map: "Відкрити маршрут",
    invite: "Запросити учасників команди",
    whenWhere: "Коли і де",
    dateLabel: "Дата",
    timeLabel: "Час",
    venueLabel: "Локація",
    contactLabel: "Контакти організаторів",
    dateValue: "27 червня 2026",
    timeValue: "09:00 – 15:30",
    venueValue: "Stadion Podskarbińska, вул. Chrzanowskiego 23, Варшава",
  },
  pl: {
    calendar: "Dodaj do Kalendarza Google",
    ticket: "Otwórz mój bilet",
    map: "Otwórz trasę",
    invite: "Zaproś członków drużyny",
    whenWhere: "Kiedy i gdzie",
    dateLabel: "Data",
    timeLabel: "Godziny",
    venueLabel: "Lokalizacja",
    contactLabel: "Kontakt z organizatorami",
    dateValue: "27 czerwca 2026",
    timeValue: "09:00 – 15:30",
    venueValue: "Stadion Podskarbińska, ul. Chrzanowskiego 23, Warszawa",
  },
  en: {
    calendar: "Add to Google Calendar",
    ticket: "Open my ticket",
    map: "Open route",
    invite: "Invite team members",
    whenWhere: "When & where",
    dateLabel: "Date",
    timeLabel: "Time",
    venueLabel: "Venue",
    contactLabel: "Organizer contacts",
    dateValue: "27 June 2026",
    timeValue: "09:00 – 15:30",
    venueValue: "Stadion Podskarbińska, Chrzanowskiego 23, Warsaw",
  },
};

export function contactValue() {
  return `${EVENT.contact.phone} · ${EVENT.contact.email}`;
}

const GREETING: Record<MailLocale, (name: string) => string> = {
  ua: (n) => `Привіт, ${n}!`,
  pl: (n) => `Cześć, ${n}!`,
  en: (n) => `Hi ${n}!`,
};

type Builder = (locale: MailLocale, ctx: LifecycleCtx) => Omit<LifecycleContent, "greeting">;

const BUILDERS: Record<LifecycleKind, Builder> = {
  reminder_14d: (locale) =>
    ({
      ua: {
        preview: "До ACE BATTLE RUN лишилося 2 тижні",
        eyebrow: "За 2 тижні",
        title: "Скоро ACE BATTLE RUN",
        intro:
          "До старту лишилося два тижні. Нагадуємо: це командний формат — збери свою команду або приходь, і ми допоможемо тобі приєднатися.",
        outro: "Додай подію в календар, щоб точно не пропустити.",
        showWhenWhere: false,
        actions: ["calendar"] as LifecycleAction[],
      },
      pl: {
        preview: "Do ACE BATTLE RUN zostały 2 tygodnie",
        eyebrow: "Za 2 tygodnie",
        title: "Już wkrótce ACE BATTLE RUN",
        intro:
          "Do startu zostały dwa tygodnie. Przypominamy: to format drużynowy — zbierz drużynę albo przyjdź, a pomożemy Ci dołączyć.",
        outro: "Dodaj wydarzenie do kalendarza, żeby nie przegapić.",
        showWhenWhere: false,
        actions: ["calendar"] as LifecycleAction[],
      },
      en: {
        preview: "2 weeks until ACE BATTLE RUN",
        eyebrow: "2 weeks to go",
        title: "ACE BATTLE RUN is coming",
        intro:
          "Two weeks until the start. A reminder: this is a team format — bring your team, or just come and we'll help you join one.",
        outro: "Add the event to your calendar so you don't miss it.",
        showWhenWhere: false,
        actions: ["calendar"] as LifecycleAction[],
      },
    })[locale],

  reminder_7d: (locale) =>
    ({
      ua: {
        preview: "ACE BATTLE RUN — за тиждень",
        eyebrow: "За 7 днів",
        title: "Організаційна інформація",
        intro: "До зустрічі лишається тиждень. Ось що важливо знати заздалегідь.",
        bullets: [
          "Реєстрація та видача номерів — з 09:00",
          "Візьми спортивний одяг",
          "Зручне взуття",
          "Телефон із QR-кодом квитка",
        ],
        showWhenWhere: true,
        actions: ["calendar"] as LifecycleAction[],
      },
      pl: {
        preview: "ACE BATTLE RUN — za tydzień",
        eyebrow: "Za 7 dni",
        title: "Informacje organizacyjne",
        intro: "Do spotkania został tydzień. Oto co warto wiedzieć z wyprzedzeniem.",
        bullets: [
          "Rejestracja i wydawanie numerów — od 09:00",
          "Zabierz strój sportowy",
          "Wygodne obuwie",
          "Telefon z kodem QR biletu",
        ],
        showWhenWhere: true,
        actions: ["calendar"] as LifecycleAction[],
      },
      en: {
        preview: "ACE BATTLE RUN — one week to go",
        eyebrow: "7 days to go",
        title: "Event logistics",
        intro: "One week until we meet. Here's what's good to know in advance.",
        bullets: [
          "Registration & bib pickup — from 09:00",
          "Bring sportswear",
          "Comfortable shoes",
          "Phone with your QR ticket",
        ],
        showWhenWhere: true,
        actions: ["calendar"] as LifecycleAction[],
      },
    })[locale],

  reminder_3d: (locale) =>
    ({
      ua: {
        preview: "За 3 дні — ACE BATTLE RUN",
        eyebrow: "За 3 дні",
        title: "Скоро побачимося на старті",
        intro: "Залишилося зовсім трохи. Раджу приїхати заздалегідь, щоб спокійно пройти реєстрацію.",
        bullets: [
          "Приїхати за 30–40 хв до старту",
          "QR-квиток у телефоні",
          "Спортивна форма та взуття",
          "Гарний настрій 🔥",
        ],
        showWhenWhere: true,
        actions: ["calendar"] as LifecycleAction[],
      },
      pl: {
        preview: "Za 3 dni — ACE BATTLE RUN",
        eyebrow: "Za 3 dni",
        title: "Już niedługo widzimy się na starcie",
        intro: "Zostało naprawdę niewiele. Przyjedź wcześniej, żeby spokojnie przejść rejestrację.",
        bullets: [
          "Przyjedź 30–40 min przed startem",
          "Bilet QR w telefonie",
          "Strój i obuwie sportowe",
          "Dobry nastrój 🔥",
        ],
        showWhenWhere: true,
        actions: ["calendar"] as LifecycleAction[],
      },
      en: {
        preview: "3 days until ACE BATTLE RUN",
        eyebrow: "3 days to go",
        title: "See you at the start line soon",
        intro: "Almost there. Come a little early so you can register without a rush.",
        bullets: [
          "Arrive 30–40 min before the start",
          "QR ticket on your phone",
          "Sportswear and shoes",
          "Good vibes 🔥",
        ],
        showWhenWhere: true,
        actions: ["calendar"] as LifecycleAction[],
      },
    })[locale],

  reminder_1d: (locale) =>
    ({
      ua: {
        preview: "Завтра — ACE BATTLE RUN",
        eyebrow: "Завтра",
        title: "Завтра — старт!",
        intro: "Практична інформація на завтра. Покажи QR-квиток на вході — і вперед.",
        bullets: ["Збір з 09:00", "Старт за розкладом", "Май квиток напоготові у телефоні"],
        outro: "Питання? Телефонуй організаторам.",
        showWhenWhere: true,
        actions: ["ticket", "map"] as LifecycleAction[],
      },
      pl: {
        preview: "Jutro — ACE BATTLE RUN",
        eyebrow: "Jutro",
        title: "Jutro start!",
        intro: "Praktyczne informacje na jutro. Pokaż bilet QR przy wejściu — i działamy.",
        bullets: ["Zbiórka od 09:00", "Start zgodnie z harmonogramem", "Miej bilet gotowy w telefonie"],
        outro: "Pytania? Zadzwoń do organizatorów.",
        showWhenWhere: true,
        actions: ["ticket", "map"] as LifecycleAction[],
      },
      en: {
        preview: "Tomorrow — ACE BATTLE RUN",
        eyebrow: "Tomorrow",
        title: "Tomorrow is race day!",
        intro: "Practical info for tomorrow. Show your QR ticket at the entrance and you're in.",
        bullets: ["Gather from 09:00", "Start per the schedule", "Keep your ticket ready on your phone"],
        outro: "Questions? Call the organizers.",
        showWhenWhere: true,
        actions: ["ticket", "map"] as LifecycleAction[],
      },
    })[locale],

  morning: (locale) =>
    ({
      ua: {
        preview: "Сьогодні ACE BATTLE RUN",
        eyebrow: "Сьогодні",
        title: "Сьогодні ACE BATTLE RUN",
        intro:
          "Час: 09:00 – 15:30. Локація: Stadion Podskarbińska, Варшава. Покажи QR-квиток на вході. До зустрічі!",
        showWhenWhere: false,
        actions: ["ticket"] as LifecycleAction[],
      },
      pl: {
        preview: "Dziś ACE BATTLE RUN",
        eyebrow: "Dziś",
        title: "Dziś ACE BATTLE RUN",
        intro:
          "Godziny: 09:00 – 15:30. Lokalizacja: Stadion Podskarbińska, Warszawa. Pokaż bilet QR przy wejściu. Do zobaczenia!",
        showWhenWhere: false,
        actions: ["ticket"] as LifecycleAction[],
      },
      en: {
        preview: "Today is ACE BATTLE RUN",
        eyebrow: "Today",
        title: "Today is ACE BATTLE RUN",
        intro:
          "Time: 09:00 – 15:30. Venue: Stadion Podskarbińska, Warsaw. Show your QR ticket at the entrance. See you there!",
        showWhenWhere: false,
        actions: ["ticket"] as LifecycleAction[],
      },
    })[locale],

  captain_incomplete: (locale, ctx) => {
    const n = ctx.remaining ?? 0;
    const team = ctx.teamName ?? "";
    return {
      ua: {
        preview: "У вашій команді ще не всі зареєстровані",
        eyebrow: "Команда",
        title: "У вашій команді ще не всі зареєстровані",
        intro: team ? `Команда «${team}». Залишилося зареєструвати: ${n}.` : `Залишилося зареєструвати: ${n}.`,
        outro: "Поділися посиланням-запрошенням нижче, щоб усі приєдналися.",
        showWhenWhere: false,
        actions: ["invite"] as LifecycleAction[],
      },
      pl: {
        preview: "Nie wszyscy z Twojej drużyny są jeszcze zarejestrowani",
        eyebrow: "Drużyna",
        title: "Nie wszyscy z Twojej drużyny są jeszcze zarejestrowani",
        intro: team ? `Drużyna „${team}". Pozostało do zarejestrowania: ${n}.` : `Pozostało do zarejestrowania: ${n}.`,
        outro: "Udostępnij link z zaproszeniem poniżej, aby wszyscy dołączyli.",
        showWhenWhere: false,
        actions: ["invite"] as LifecycleAction[],
      },
      en: {
        preview: "Not everyone on your team has registered yet",
        eyebrow: "Team",
        title: "Not everyone on your team has registered yet",
        intro: team ? `Team "${team}". Still to register: ${n}.` : `Still to register: ${n}.`,
        outro: "Share the invitation link below so everyone can join.",
        showWhenWhere: false,
        actions: ["invite"] as LifecycleAction[],
      },
    }[locale];
  },
};

export function lifecycleContent(
  kind: LifecycleKind,
  locale: MailLocale,
  ctx: LifecycleCtx,
): LifecycleContent {
  return { greeting: GREETING[locale](firstName(ctx.fullName)), ...BUILDERS[kind](locale, ctx) };
}
