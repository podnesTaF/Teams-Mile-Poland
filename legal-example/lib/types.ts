export type Locale = "pl" | "en" | "ua" | "ru";

export const LOCALES: Locale[] = ["pl", "en", "ua", "ru"];
export const DEFAULT_LOCALE: Locale = "pl";

export type EventStatus = "open" | "soon" | "closed" | "finished";

/**
 * Rodzaj wydarzenia — determinuje, który komplet dokumentów (i który
 * wariant formularza rejestracji) ma zastosowanie. Na razie w pełni
 * obsługiwane są "individual" i "team"; "tournament" i "league" są
 * już częścią modelu danych (żeby admin mógł je od razu tworzyć w
 * panelu), ale nie mają jeszcze własnych treści dokumentów — patrz
 * DOCUMENT_SLUGS_BY_EVENT_TYPE poniżej i uwaga w README.
 */
export type EventType = "individual" | "team" | "tournament" | "league";

export const EVENT_TYPES: EventType[] = [
  "individual",
  "team",
  "tournament",
  "league",
];

/**
 * Rekord wydarzenia — w produkcji pochodzi z bazy danych organizatora
 * (ten sam system, który zasila poland.acebattle.run/#events).
 * Tutaj: mockowana lista bazowa w lib/events.ts + wydarzenia dodane
 * ręcznie przez administratora w panelu (lib/events-store.ts),
 * wystawione łącznie przez /api/events.
 *
 * UWAGA: celowo NIE ma tu pola z pulą nagród — nagrody mogą być wspólne
 * dla kilku wydarzeń naraz (np. cała klasyfikacja sezonowa), więc kwota
 * nie jest właściwością pojedynczego wydarzenia i nie powinna być
 * wyświetlana na karcie pojedynczej edycji.
 *
 * Jedno "wydarzenie" (np. cykl "TEAM MILE POLAND") może obejmować
 * KILKA dni biegów w różnych terminach — każdy taki dzień to osobny
 * EventRecord z tym samym `seriesId`/`seriesName`, ale własną datą.
 * Uczestnik wybiera konkretny dzień (konkretny EventRecord), a komplet
 * dokumentów jest wspólny dla całej serii (określony przez `eventType`).
 */
export interface EventRecord {
  id: string; // np. "mile-2026-08-29" albo "team-mile-2026-09-22"
  slug: string; // segment URL wydarzenia na głównej stronie
  eventType: EventType;
  /** Nazwa całej serii/cyklu, np. "ACE BATTLE RUN – TEAM MILE POLAND – TEAM–Individual Ranking". Wspólna dla wszystkich dni tej samej serii. */
  seriesName: string;
  /** Identyfikator serii — wszystkie dni tego samego cyklu mają ten sam seriesId. */
  seriesId: string;
  dateISO: string; // "2026-08-29"
  timeStart: string; // "10:00"
  venueName: string; // "Stadion Podskarbińska"
  venueAddress: string; // "ul. Wojciecha Chrzanowskiego 23, 04-394 Warszawa"
  city: string;
  status: EventStatus;
  entryFeeFree: boolean;
  organizerLegalName: string;
  organizerKRS: string;
  organizerNIP: string;
  organizerAddress: string;
  organizerEmail: string;
  organizerPhone: string;
  /** Czy wydarzenie zostało dodane ręcznie przez administratora (vs. wbudowana lista startowa). */
  isCustom?: boolean;
}

/**
 * Dokumenty WIDOCZNE DLA UCZESTNIKA — każdy z formularzem zgody.
 * Zestaw zależy od rodzaju wydarzenia (patrz DOCUMENT_SLUGS_BY_EVENT_TYPE).
 *
 *  - individual: dokumenty indywidualnego biegu rankingowego (istniejące).
 *  - team: dokumenty drużynowo-indywidualnego formatu TEAM MILE POLAND.
 */
export type DocumentSlug =
  | "oswiadczenie"
  | "przepisy"
  | "rodo"
  | "team-oswiadczenie"
  | "team-regulations"
  | "team-rules"
  | "team-rodo";

export const DOCUMENT_SLUGS: DocumentSlug[] = [
  "oswiadczenie",
  "przepisy",
  "rodo",
];

export const TEAM_DOCUMENT_SLUGS: DocumentSlug[] = [
  "team-oswiadczenie",
  "team-regulations",
  "team-rules",
  "team-rodo",
];

/** Który komplet dokumentów uczestnika pokazujemy dla danego rodzaju wydarzenia. */
export const DOCUMENT_SLUGS_BY_EVENT_TYPE: Record<EventType, DocumentSlug[]> = {
  individual: DOCUMENT_SLUGS,
  team: TEAM_DOCUMENT_SLUGS,
  // Brak jeszcze dostarczonych dokumentów dla tych formatów — puste listy,
  // żeby reszta kodu (mapowania, pętle po DOCUMENT_SLUGS_BY_EVENT_TYPE)
  // działała bezpiecznie, zamiast rzucać wyjątkiem na nieznanym rodzaju.
  tournament: [],
  league: [],
};

/**
 * Dokumenty WEWNĘTRZNE — widoczne wyłącznie w panelu administratora
 * (/admin/documents/...). Uczestnik nigdy ich nie widzi i niczego w nich
 * nie podpisuje; to materiały robocze/analityczne/referencyjne dla
 * organizatora.
 */
export type InternalDocSlug =
  | "regulamin"
  | "lia"
  | "potwierdzenie"
  | "team-lia"
  | "team-potwierdzenie"
  | "team-captain"
  | "team-appendix1"
  | "team-appendix2"
  | "team-appendix3"
  | "team-appendix4"
  | "team-appendix5";

export const INTERNAL_DOCUMENT_SLUGS: InternalDocSlug[] = [
  "regulamin",
  "lia",
  "potwierdzenie",
];

export const TEAM_INTERNAL_DOCUMENT_SLUGS: InternalDocSlug[] = [
  "team-lia",
  "team-potwierdzenie",
  "team-captain",
  "team-appendix1",
  "team-appendix2",
  "team-appendix3",
  "team-appendix4",
  "team-appendix5",
];

/**
 * Spośród dokumentów wewnętrznych serii "team", część Załączników jest
 * dodatkowo udostępniana PUBLICZNIE uczestnikom do wglądu (bez
 * logowania do panelu administratora) — jako osobne kafelki na hubie
 * dokumentów, wyłącznie do czytania (bez pola zgody/podpisu).
 *
 * Załącznik 2 ("Harmonogram wydarzenia dla ORGANIZATORÓW") celowo NIE
 * jest tu wymieniony — dotyczy wyłącznie wewnętrznych czynności zespołu
 * organizacyjnego i sędziowskiego, nie uczestnika, więc zostaje
 * wyłącznie w /admin/documents/team-appendix2 (patrz
 * TEAM_INTERNAL_DOCUMENT_SLUGS powyżej). LIA, Potwierdzenie i
 * Provisions on the Team Captain również pozostają wyłącznie wewnętrzne.
 */
export const PUBLIC_APPENDIX_SLUGS: InternalDocSlug[] = [
  "team-appendix1",
  "team-appendix3",
  "team-appendix4",
  "team-appendix5",
];

/** Slug dokumentu prawnego niezależnie od tego, czy jest publiczny czy wewnętrzny — używane przez lib/legal-texts.ts. */
export type AnyDocSlug = DocumentSlug | InternalDocSlug;

export type FieldName =
  | "fullName"
  | "birthDate"
  | "phoneOrEmail"
  | "address"
  | "emergencyContact"
  | "bankAccount"
  | "taxId"
  | "confirmerName"
  | "teamName"
  | "teamRole";

export const TEAM_ROLES = ["RACER", "ACE", "JOKER"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export type ImageConsentChoice = "agree" | "disagree";
