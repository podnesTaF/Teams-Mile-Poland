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

/**
 * The conditional "are you coming?" block inside the reminder emails (PRD #26,
 * slice #28). Not a separate email kind — the ask rides the reminders that
 * already go out, so confirming costs the runner no extra attention.
 */
export type ConfirmBlockCopy = { title: string; body: string; cta: string };

const CONFIRM_BLOCK: Record<MailLocale, ConfirmBlockCopy> = {
  ua: {
    title: "Ти біжиш?",
    body: "Підтверди участь, щоб ми внесли тебе до забігу. Це одна кнопка — пароль не потрібен.",
    cta: "Так, я буду",
  },
  pl: {
    title: "Będziesz na starcie?",
    body: "Potwierdź udział, abyśmy mogli przypisać Cię do biegu. Jedno kliknięcie — hasło nie jest potrzebne.",
    cta: "Tak, będę",
  },
  en: {
    title: "Are you racing?",
    body: "Confirm your attendance so we can put you in a heat. One tap — no password needed.",
    cta: "Yes, I am coming",
  },
};

/**
 * Reminder kinds that carry the confirmation ask. The morning-of email does
 * not: by then the heat card is published and the answer is moot.
 */
const CONFIRM_ASK_KINDS: readonly EventScheduledKind[] = [
  "reminder_7d",
  "reminder_3d",
  "reminder_1d",
];

export function asksForConfirmation(kind: EventScheduledKind): boolean {
  return CONFIRM_ASK_KINDS.includes(kind);
}

export function confirmBlockCopy(locale: MailLocale): ConfirmBlockCopy {
  return CONFIRM_BLOCK[locale];
}

/**
 * Copy for the manual, admin-triggered "your photos are live" mailing
 * (`media_live` kind — PRD #14, slice #18). Not part of the scheduled chain, so
 * it lives outside {@link BUILDERS}. `title` doubles as the email subject and the
 * hero title; `cta` labels the button that opens the event's gallery page.
 */
export type MediaLiveContent = {
  preview: string;
  eyebrow: string;
  title: string;
  greeting: string;
  intro: string;
  cta: string;
  outro: string;
};

const MEDIA_LIVE: Record<MailLocale, Omit<MediaLiveContent, "greeting">> = {
  ua: {
    preview: "Фото та відео з твоєї милі вже онлайн",
    eyebrow: "Галерея відкрита",
    title: "Твої фото вже тут",
    intro:
      "Фотограф завершив обробку — світлини та відео з твого забігу вже опубліковані. Переглядай, гортай у повний розмір і завантажуй свої кадри.",
    cta: "Відкрити галерею",
    outro: "На сторінці галереї також є посилання на повний альбом у Google Диску.",
  },
  pl: {
    preview: "Zdjęcia i wideo z Twojej mili są już online",
    eyebrow: "Galeria otwarta",
    title: "Twoje zdjęcia są już tutaj",
    intro:
      "Fotograf skończył obróbkę — zdjęcia i wideo z Twojego biegu są już opublikowane. Przeglądaj, otwieraj w pełnym rozmiarze i pobieraj swoje kadry.",
    cta: "Otwórz galerię",
    outro: "Na stronie galerii znajdziesz też link do pełnego albumu na Dysku Google.",
  },
  en: {
    preview: "Photos and video from your mile are online",
    eyebrow: "Gallery is live",
    title: "Your photos are here",
    intro:
      "The photographer's edit is in — photos and video from your race are now published. Browse the grid, open shots at full size and download your favourites.",
    cta: "Open the gallery",
    outro: "The gallery page also links to the full album on Google Drive.",
  },
};

export function mediaLiveMailContent(locale: MailLocale, fullName: string): MediaLiveContent {
  return { greeting: GREETING[locale](firstName(fullName)), ...MEDIA_LIVE[locale] };
}

/**
 * Copy for the heat-assignment mailing (`heat_assignment` kind — PRD #26, slice
 * #30), dispatched by `publishHeats` rather than the scheduled chain.
 *
 * One kind, two voices: the first notice announces the heat, a later send
 * announces that it *moved*. Only `eyebrow` / `title` / `intro` differ — the
 * facts and the approximate-time caveat are identical either way, so they are
 * written once. The CTA label is the shared {@link UI} "open my ticket".
 */
export type HeatAssignmentContent = {
  preview: string;
  eyebrow: string;
  title: string;
  greeting: string;
  intro: string;
  heatLabel: string;
  timeLabel: string;
  approxNote: string;
  cta: string;
  outro: string;
};

/** The half of the copy that differs between a first notice and a change. */
type HeatVoice = Pick<HeatAssignmentContent, "preview" | "eyebrow" | "title" | "intro">;

const HEAT_FIRST: Record<MailLocale, HeatVoice> = {
  ua: {
    preview: "Твій забіг і приблизний час старту",
    eyebrow: "Стартовий список",
    title: "Твій забіг",
    intro: "Стартовий список готовий. Ось твій забіг і приблизний час старту.",
  },
  pl: {
    preview: "Twoja seria i przybliżona godzina startu",
    eyebrow: "Lista startowa",
    title: "Twoja seria",
    intro: "Lista startowa jest gotowa. Oto Twoja seria i przybliżona godzina startu.",
  },
  en: {
    preview: "Your heat and approximate start time",
    eyebrow: "Start list",
    title: "Your heat",
    intro: "The start list is set. Here is your heat and your approximate start time.",
  },
};

const HEAT_CHANGED: Record<MailLocale, HeatVoice> = {
  ua: {
    preview: "Твій забіг змінився",
    eyebrow: "Зміна",
    title: "Твій забіг змінився",
    intro:
      "Стартовий список оновлено — твій забіг або час старту змінився. Це актуальні дані; попередній лист більше не діє.",
  },
  pl: {
    preview: "Twoja seria się zmieniła",
    eyebrow: "Zmiana",
    title: "Twoja seria się zmieniła",
    intro:
      "Lista startowa została zaktualizowana — Twoja seria lub godzina startu się zmieniła. To są aktualne dane; poprzednia wiadomość jest nieaktualna.",
  },
  en: {
    preview: "Your heat has changed",
    eyebrow: "Change",
    title: "Your heat has changed",
    intro:
      "The start list has been updated — your heat or start time has moved. These are the current details; the earlier email is out of date.",
  },
};

/** The facts and the caveat — identical in both voices. */
const HEAT_FACTS: Record<
  MailLocale,
  Pick<HeatAssignmentContent, "heatLabel" | "timeLabel" | "approxNote" | "outro">
> = {
  ua: {
    heatLabel: "Забіг",
    timeLabel: "Приблизний час старту",
    approxNote:
      "Час приблизний — забіги можуть зсуватися. Будь на стадіоні щонайменше за 30 хвилин до свого забігу.",
    outro: "Номер отримаєш на реєстрації в день забігу.",
  },
  pl: {
    heatLabel: "Seria",
    timeLabel: "Przybliżona godzina startu",
    approxNote:
      "Godzina jest przybliżona — serie mogą się przesuwać. Bądź na stadionie najpóźniej 30 minut przed swoją serią.",
    outro: "Numer startowy odbierzesz przy rejestracji w dniu biegu.",
  },
  en: {
    heatLabel: "Heat",
    timeLabel: "Approximate start",
    approxNote:
      "The time is approximate — heats can drift. Be at the stadium at least 30 minutes before your heat.",
    outro: "You'll collect your bib at check-in on race day.",
  },
};

export function heatAssignmentMailContent(
  locale: MailLocale,
  fullName: string,
  opts: { changed: boolean },
): HeatAssignmentContent {
  return {
    ...(opts.changed ? HEAT_CHANGED[locale] : HEAT_FIRST[locale]),
    ...HEAT_FACTS[locale],
    greeting: GREETING[locale](firstName(fullName)),
    cta: UI[locale].ticket,
  };
}

/**
 * Subject line for the heat mailing. Carries the heat and the (approximate) time
 * in the subject itself, so a runner scanning an inbox on race morning does not
 * have to open anything — and so a change is legible as a change in the list.
 */
export function heatAssignmentSubject(
  locale: MailLocale,
  opts: { heatNumber: number; startTime: string; changed: boolean },
): string {
  const { heatNumber: n, startTime: t, changed } = opts;
  return {
    ua: changed ? `Зміна: забіг ${n}, приблизно ${t}` : `Твій забіг: ${n}, приблизно ${t}`,
    pl: changed ? `Zmiana: seria ${n}, ok. ${t}` : `Twoja seria: ${n}, ok. ${t}`,
    en: changed ? `Changed: heat ${n}, approx. ${t}` : `Your heat: ${n}, approx. ${t}`,
  }[locale];
}
