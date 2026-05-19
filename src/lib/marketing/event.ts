/**
 * Static event metadata. Mirrors the regulations document.
 * Kept server-friendly (no React, no client-only APIs) so it can be
 * consumed by RSC, route handlers, and metadata builders alike.
 */

export const EVENT = {
  name: "TEAMS MILE Warsaw",
  date: "2026-06-27",
  dateLabel: { en: "27 June 2026", pl: "27 czerwca 2026" },
  shortDate: "27 · 06 · 2026",
  venue: {
    name: "Stadion Podskarbińska",
    address: "Wojciecha Chrzanowskiego 23",
    city: "Warsaw",
    postal: "04-394",
    country: "Poland",
    track: { lanes: 8, length: "400 m", surface: "Tartan" },
  },
  freeTier: {
    total: 300,
    pricePln: 50,
  },
} as const;

export type AgeCategory = {
  code: string;
  name: string;
  age: string;
};

export const AGE_CATEGORIES: AgeCategory[] = [
  { code: "U12", name: "Youth", age: "Born 2014–2015" },
  { code: "U14", name: "Youth", age: "Born 2012–2013" },
  { code: "U16", name: "Cadets", age: "Born 2010–2011" },
  { code: "U18", name: "Juniors", age: "Born 2008–2009" },
  { code: "U20", name: "Juniors", age: "Born 2006–2007" },
  { code: "U23", name: "Espoirs", age: "Born 2003–2005" },
  { code: "SEN", name: "Seniors", age: "23 – 39" },
  { code: "M40", name: "Masters", age: "40 – 54" },
  { code: "V55", name: "Veterans", age: "55+" },
];

export type ScheduleRow = {
  time: string;
  name: string;
  meta: string;
  key?: boolean;
};

export const SCHEDULE: ScheduleRow[] = [
  { time: "09:00–10:00", name: "Registration & chip pickup", meta: "All athletes" },
  { time: "10:00–10:15", name: "Opening ceremony", meta: "Centre track" },
  { time: "10:30–12:00", name: "Individual rating mile runs", meta: "By age category", key: true },
  { time: "12:00–13:00", name: "Team prep break", meta: "Warm-up" },
  { time: "13:00–14:00", name: "Team mile races", meta: "Headline event", key: true },
  { time: "14:30–15:00", name: "Awards ceremony", meta: "Podium" },
  { time: "15:00–15:30", name: "Closing", meta: "—" },
];

export type Role = {
  rank: string;
  name: "Racer" | "Ace" | "Joker";
  line: string;
  detail: string;
  accent?: boolean;
};

export const ROLES: Role[] = [
  { rank: "10", name: "Racer", line: "Runs the full mile, start to finish.", detail: "3 per team" },
  { rank: "J", name: "Ace", line: "Starts with everyone, hands off the baton inside the Joker Zone, then stays put.", detail: "Pairs with a Joker", accent: true },
  { rank: "Q", name: "Joker", line: "Waits in the Joker Zone, takes the baton, runs to the finish line.", detail: "Pairs with an Ace", accent: true },
];

export type Faq = { q: string; a: string };

export const FAQS: Faq[] = [
  {
    q: "What is TEAMS MILE in one sentence?",
    a: "A team mile race with role-switching and a baton hand-off.",
  },
  {
    q: "What does the 50 PLN cover?",
    a: "Runner entry, bib, timing, medal, hydration, and ranking.",
  },
  {
    q: "How does the free tier work?",
    a: "First 300 registered runners pay 0 PLN. After that, every runner pays 50 PLN.",
  },
  {
    q: "I don't have a team. Can I still race?",
    a: 'Yes. Choose "Find me a team" or register for the solo mile.',
  },
  {
    q: "Do I need a medical certificate?",
    a: "No. You complete a medical self-declaration during registration.",
  },
  {
    q: "What gear is or isn't allowed?",
    a: "Running shoes only. No metal spikes or headphones during races.",
  },
  {
    q: "When does registration close?",
    a: "20 June 2026.",
  },
];

export type RegistrationPath = {
  id: "start" | "join" | "free" | "solo";
  num: string;
  rank: string;
  title: string;
  desc: string;
  meta: string;
  primary?: boolean;
};

export const REGISTRATION_PATHS: RegistrationPath[] = [
  {
    id: "start",
    num: "01",
    rank: "A",
    title: "Start a team",
    desc: "Create a team and invite runners.",
    meta: "7–12 runners",
    primary: true,
  },
  {
    id: "join",
    num: "02",
    rank: "K",
    title: "Join a team",
    desc: "Use your captain's code.",
    meta: "Invite code",
  },
  {
    id: "free",
    num: "03",
    rank: "Q",
    title: "Find me a team",
    desc: "Register now. We match you later.",
    meta: "Free agent",
  },
  {
    id: "solo",
    num: "04",
    rank: "J",
    title: "Run solo",
    desc: "Individual rating mile.",
    meta: "Individual",
  },
];

export type DocLocale = "en" | "pl";

export type LocalizedString = { en: string; pl: string };

export type DocumentFile = {
  href: string;
  meta: string;
};

export type LocalizedDocument = {
  id: string;
  tag: LocalizedString;
  title: LocalizedString;
  desc: LocalizedString;
  primary?: boolean;
  files: Partial<Record<DocLocale, DocumentFile>>;
};

export const DOCUMENTS: LocalizedDocument[] = [
  {
    id: "tournament-regs",
    tag: {
      en: "Tournament regulations",
      pl: "Regulamin zawodów",
    },
    title: {
      en: "TEAMS MILE Warsaw — Tournament Regulations",
      pl: "Regulamin zawodów TEAMS MILE Warszawa",
    },
    desc: {
      en: "Official Warsaw event rules. Published in Polish only.",
      pl: "Oficjalny regulamin zawodów w Warszawie.",
    },
    primary: true,
    files: {
      pl: {
        href: "/docs/teams-mile-warsaw-regulations.pl.pdf",
        meta: "PDF · PL",
      },
    },
  },
  {
    id: "rating-system",
    tag: {
      en: "Rating system",
      pl: "System oceniania",
    },
    title: {
      en: "ACE BATTLE — Rating System Regulations",
      pl: "Przepisy o systemie oceniania ACE BATTLE",
    },
    desc: {
      en: "Roles, ratings, divisions, time corrections, ranks, and penalties.",
      pl: "Role, oceny, dywizje, korekty czasów, rangi i kary.",
    },
    files: {
      en: {
        href: "/docs/rating-system.en.pdf",
        meta: "PDF · EN",
      },
      pl: {
        href: "/docs/rating-system.pl.pdf",
        meta: "PDF · PL",
      },
    },
  },
  {
    id: "project-presentation",
    tag: {
      en: "Project presentation",
      pl: "Prezentacja projektu",
    },
    title: {
      en: "TEAMS MILE — Project Presentation",
      pl: "TEAMS MILE — Prezentacja projektu",
    },
    desc: {
      en: "Format overview for partners, press, and sponsors.",
      pl: "Przegląd formatu dla partnerów, prasy i sponsorów.",
    },
    files: {
      en: {
        href: "/docs/project-presentation.en.pdf",
        meta: "PDF · EN",
      },
      pl: {
        href: "/docs/project-presentation.pl.pdf",
        meta: "PDF · PL",
      },
    },
  },
];

/* ──────────────────────────────────────────────────────────
 * Scarcity helpers — used by the live counter and panel.
 * ──────────────────────────────────────────────────────── */

export type UrgencyLevel = "ok" | "amber" | "red" | "gone";

export function getUrgency(remaining: number, total: number): UrgencyLevel {
  if (remaining <= 0) return "gone";
  const pct = (remaining / total) * 100;
  if (pct <= 20) return "red";
  if (pct <= 50) return "amber";
  return "ok";
}

export function formatN(n: number): string {
  return n.toLocaleString("en-US");
}
