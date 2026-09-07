import type { EventRecord } from "./types";
import { listCustomEvents } from "./events-store";

/**
 * BAZOWA (WBUDOWANA) LISTA WYDARZEŃ
 * -----------------------------------
 * To jest jedyne miejsce, które trzeba podmienić na prawdziwe zapytanie do
 * bazy danych organizatora (Postgres/Prisma, Supabase, CMS itd.).
 * Kontrakt (kształt EventRecord) jest zaprojektowany tak, aby formularze
 * (components/ConsentForm.tsx, RegisterForm.tsx) nie musiały się zmieniać
 * po podłączeniu prawdziwego źródła danych — wystarczy, że
 * getEventById/listEvents będą czytać z bazy zamiast z tej tablicy.
 *
 * Oprócz tej wbudowanej listy, `listEvents()` dolicza wydarzenia dodane
 * ręcznie przez administratora w panelu (`lib/events-store.ts`) — to
 * realizuje wymaganie „daty w dalszej kolejności dodaje/ustala admin
 * przez swój panel narzędziowy".
 *
 * Zawiera dwie serie:
 *  1. Indywidualny cykl kwalifikacyjny (eventType: "individual") —
 *     odzwierciedla cykl widoczny na poland.acebattle.run.
 *  2. ACE BATTLE RUN – TEAM MILE POLAND – TEAM–Individual Ranking
 *     (eventType: "team") — trzy dni biegów tej samej serii.
 */

const ORGANIZER = {
  organizerLegalName:
    "ACE BATTLE POLAND SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ",
  organizerKRS: "0001229475",
  organizerNIP: "5273210377",
  organizerAddress: "ul. Pańska 96 lok. 80, 00-837 Warszawa",
  organizerEmail: "info@poland.acebattle.run",
  organizerPhone: "+48 576 696 078",
} as const;

const INDIVIDUAL_VENUE = {
  venueName: 'Stadion "Podskarbińska"',
  venueAddress: "ul. Wojciecha Chrzanowskiego 23, 04-394 Warszawa",
  city: "Warszawa",
} as const;

const TEAM_SERIES_NAME =
  "ACE BATTLE RUN – TEAM MILE POLAND – TEAM–Individual Ranking";
const TEAM_SERIES_ID = "team-mile-poland-2026";

const TEAM_VENUE = {
  venueName: 'Stadion "Podskarbińska"',
  venueAddress: "ul. Wojciecha Chrzanowskiego 23, 04-394 Warszawa",
  city: "Warszawa",
} as const;

const INDIVIDUAL_SERIES_NAME =
  "Ace Battle Run Polska – Kwalifikacja na jedną milę";
const INDIVIDUAL_SERIES_ID = "individual-mile-poland-2026";

const BUILT_IN_EVENTS: EventRecord[] = [
  // --- Seria indywidualna ---
  {
    id: "mile-2026-08-29",
    slug: "mile-2026-08-29",
    eventType: "individual",
    seriesName: INDIVIDUAL_SERIES_NAME,
    seriesId: INDIVIDUAL_SERIES_ID,
    dateISO: "2026-08-29",
    timeStart: "10:00",
    ...INDIVIDUAL_VENUE,
    status: "open",
    entryFeeFree: true,
    ...ORGANIZER,
  },
  {
    id: "mile-2026-08-22",
    slug: "mile-2026-08-22",
    eventType: "individual",
    seriesName: INDIVIDUAL_SERIES_NAME,
    seriesId: INDIVIDUAL_SERIES_ID,
    dateISO: "2026-08-22",
    timeStart: "10:00",
    ...INDIVIDUAL_VENUE,
    status: "finished",
    entryFeeFree: true,
    ...ORGANIZER,
  },
  {
    id: "mile-2026-08-15",
    slug: "mile-2026-08-15",
    eventType: "individual",
    seriesName: INDIVIDUAL_SERIES_NAME,
    seriesId: INDIVIDUAL_SERIES_ID,
    dateISO: "2026-08-15",
    timeStart: "10:00",
    ...INDIVIDUAL_VENUE,
    status: "finished",
    entryFeeFree: true,
    ...ORGANIZER,
  },
  {
    id: "mile-2026-08-01",
    slug: "mile-2026-08-01",
    eventType: "individual",
    seriesName: INDIVIDUAL_SERIES_NAME,
    seriesId: INDIVIDUAL_SERIES_ID,
    dateISO: "2026-08-01",
    timeStart: "10:00",
    ...INDIVIDUAL_VENUE,
    status: "finished",
    entryFeeFree: true,
    ...ORGANIZER,
  },
  {
    id: "mile-2026-06-27",
    slug: "mile-2026-06-27",
    eventType: "individual",
    seriesName: INDIVIDUAL_SERIES_NAME,
    seriesId: INDIVIDUAL_SERIES_ID,
    dateISO: "2026-06-27",
    timeStart: "10:00",
    ...INDIVIDUAL_VENUE,
    status: "finished",
    entryFeeFree: true,
    ...ORGANIZER,
  },

  // --- Seria drużynowo-indywidualna: TEAM MILE POLAND ---
  // Trzy dni tej samej serii — uczestnik wybiera konkretny dzień, ale
  // komplet dokumentów (DOCUMENT_SLUGS_BY_EVENT_TYPE.team) jest wspólny.
  {
    id: "team-mile-2026-09-22",
    slug: "team-mile-2026-09-22",
    eventType: "team",
    seriesName: TEAM_SERIES_NAME,
    seriesId: TEAM_SERIES_ID,
    dateISO: "2026-09-22",
    timeStart: "18:00",
    ...TEAM_VENUE,
    status: "open",
    entryFeeFree: false,
    ...ORGANIZER,
  },
  {
    id: "team-mile-2026-10-01",
    slug: "team-mile-2026-10-01",
    eventType: "team",
    seriesName: TEAM_SERIES_NAME,
    seriesId: TEAM_SERIES_ID,
    dateISO: "2026-10-01",
    timeStart: "18:00",
    ...TEAM_VENUE,
    status: "open",
    entryFeeFree: false,
    ...ORGANIZER,
  },
  {
    id: "team-mile-2026-10-10",
    slug: "team-mile-2026-10-10",
    eventType: "team",
    seriesName: TEAM_SERIES_NAME,
    seriesId: TEAM_SERIES_ID,
    dateISO: "2026-10-10",
    timeStart: "10:00",
    ...TEAM_VENUE,
    status: "open",
    entryFeeFree: false,
    ...ORGANIZER,
  },
];

/**
 * Pełna lista wydarzeń: wbudowane + dodane ręcznie przez administratora
 * (patrz app/admin/(authenticated)/events, lib/events-store.ts).
 * Posortowane rosnąco po dacie, żeby selektor wydarzeń i karta
 * "Wybierz inną edycję" pokazywały je w naturalnej kolejności.
 */
export function listEvents(): EventRecord[] {
  const all = [...BUILT_IN_EVENTS, ...listCustomEvents()];
  return all.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
}

export function getEventById(id: string): EventRecord | undefined {
  return listEvents().find((e) => e.id === id);
}

/** Najbliższe otwarte wydarzenie — domyślne dla formularzy bez ?event=. */
export function getNextOpenEvent(): EventRecord {
  const events = listEvents();
  const open = events.find((e) => e.status === "open");
  return open ?? (events[0] as EventRecord);
}

/** Najbliższe otwarte wydarzenie DANEGO rodzaju — używane, gdy uczestnik wybiera format zawodów. */
export function getNextOpenEventOfType(
  eventType: EventRecord["eventType"],
): EventRecord | undefined {
  return listEvents().find(
    (e) => e.eventType === eventType && e.status === "open",
  );
}

/** Wszystkie dni należące do tej samej serii co podane wydarzenie (do przełącznika "inna edycja tej serii"). */
export function listEventsInSameSeries(seriesId: string): EventRecord[] {
  return listEvents().filter((e) => e.seriesId === seriesId);
}
