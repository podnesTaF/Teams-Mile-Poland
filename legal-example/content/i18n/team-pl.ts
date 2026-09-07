import type { DocumentContent, InternalDocumentMeta } from "../types";
import type { DocumentSlug, InternalDocSlug } from "@/lib/types";

/**
 * Treści dla serii "ACE BATTLE RUN – TEAM MILE POLAND – TEAM–Individual
 * Ranking" (eventType: "team") — dokumenty uzupełniające istniejący
 * komplet dla wydarzeń indywidualnych. Importowane i scalane w pl.ts.
 */

export const teamDocumentsPl: Record<"team-oswiadczenie" | "team-regulations" | "team-rules" | "team-rodo", DocumentContent> = {
  "team-oswiadczenie": {
    slug: "team-oswiadczenie",
    kicker: "Dokument główny",
    title: "Oświadczenie Uczestnika Wydarzenia",
    eventLine: "Dotyczy wydarzenia: {event}",
    intro: [
      "Ten formularz dotyczy serii ACE BATTLE RUN – TEAM MILE POLAND – TEAM–Individual Ranking (format drużynowo-indywidualny). Potwierdzasz w nim swoje dane, pełnoletność i stan zdrowia, przyjmujesz typowe ryzyka biegu, a także podajesz nazwę swojej drużyny i przydzieloną rolę (RACER / ACE / JOKER).",
      "Wypełnij wszystkie pola oznaczone gwiazdką i zaznacz wymagane zgody.",
    ],
    officialDocLabel: "Pełna treść Oświadczenia Uczestnika",
    fields: [
      {
        name: "fullName",
        label: "Imię i nazwisko uczestnika",
        placeholder: "Jan Kowalski",
        required: true,
        type: "text",
      },
      {
        name: "birthDate",
        label: "Data urodzenia",
        required: true,
        type: "date",
        helpText: "Potrzebne do potwierdzenia ukończenia 18 lat.",
      },
      {
        name: "phoneOrEmail",
        label: "Telefon i / lub e-mail",
        placeholder: "+48 500 000 000 lub jan@przyklad.pl",
        required: true,
        type: "text",
      },
      {
        name: "emergencyContact",
        label: "Osoba do kontaktu w nagłym wypadku (imię i telefon)",
        placeholder: "Anna Kowalska, +48 500 111 222",
        required: true,
        type: "text",
      },
      {
        name: "address",
        label: "Adres zamieszkania",
        required: false,
        type: "text",
        helpText: "Opcjonalnie — nie jest publikowany w wynikach.",
      },
      {
        name: "teamName",
        label: "Nazwa drużyny",
        placeholder: "np. Warsaw Runners",
        required: true,
        type: "text",
        helpText: "Zgodnie z § 3 Regulaminu — musi zawierać nazwę regionu.",
      },
      {
        name: "teamRole",
        label: "Rola w biegu drużynowym",
        required: true,
        type: "select",
        options: ["RACER", "ACE", "JOKER"],
        placeholder: "Wybierz rolę",
        helpText: "Ostateczne role są potwierdzane podczas Check-in.",
      },
      {
        name: "bankAccount",
        label: "Numer rachunku bankowego",
        required: false,
        type: "text",
        conditional: "prizeWinner",
        helpText:
          "Wypełnij tylko, jeśli Twoja drużyna zajęła miejsce nagrodzone (Załącznik 3). Nie jest wymagane przy zwykłej rejestracji.",
      },
      {
        name: "taxId",
        label: "PESEL lub NIP (do rozliczenia podatkowego nagrody)",
        required: false,
        type: "text",
        conditional: "prizeWinner",
        helpText:
          "Wymagane wyłącznie przy nagrodzie pieniężnej przekraczającej 2000 PLN na osobę.",
      },
    ],
    checkboxes: [
      {
        id: "ageAndHealth",
        required: true,
        label:
          "Oświadczam, że w dniu wydarzenia mam ukończone 18 lat, biorę udział dobrowolnie, a mój stan zdrowia pozwala mi na bezpieczny udział.",
      },
      {
        id: "risks",
        required: true,
        label:
          "Rozumiem i świadomie przyjmuję typowe ryzyka udziału w zawodach biegowych (upadek, zderzenie, odwodnienie, urazy i inne).",
      },
      {
        id: "rulesAndRegulations",
        required: true,
        label:
          'Zapoznałem/-am się z Regulaminem Publicznym oraz z Zasadami Przeprowadzania Drużynowego Biegu Rankingowego ("Zasady TEAM MILE") i zobowiązuję się ich przestrzegać.',
      },
      {
        id: "rodoRead",
        required: true,
        label:
          "Otrzymałem/-am lub miałem/-am możliwość zapoznania się z Klauzulą Informacyjną RODO dla uczestników tej serii wydarzeń.",
      },
      {
        id: "publicResults",
        required: true,
        label:
          "Zostałem/-am poinformowany/-a, że moje imię, nazwisko, czas, miejsce w rankingu, kategoria sportowa oraz nazwa drużyny mogą zostać opublikowane publicznie na stronie wydarzenia.",
      },
      {
        id: "prizeDataUnderstanding",
        required: true,
        label:
          "Rozumiem, że w przypadku zajęcia miejsca nagrodzonego wypłata nagrody wymaga podania danych do przelewu i — jeśli to niezbędne — rozliczenia podatkowego (Załącznik 3).",
      },
    ],
    imageConsent: {
      question: "Wizerunek, zdjęcia i nagrania — odrębna dobrowolna zgoda",
      agreeLabel:
        "WYRAŻAM ZGODĘ na wykorzystywanie i rozpowszechnianie mojego indywidualnie rozpoznawalnego wizerunku utrwalonego podczas wydarzenia w materiałach informacyjnych, sprawozdawczych i promocyjnych Organizatora, bez odrębnego wynagrodzenia. Zgodę mogę wycofać na przyszłość w dowolnym momencie.",
      agreeNote: "Zgoda dobrowolna — możesz ją wycofać w każdej chwili.",
      disagreeLabel:
        "NIE WYRAŻAM ZGODY na wykorzystywanie mojego indywidualnie rozpoznawalnego wizerunku na podstawie dobrowolnej zgody.",
      disagreeNote:
        "Brak zgody nie wpływa na Twoje prawo udziału w wydarzeniu.",
    },
    submitLabel: "Podpisz i wyślij oświadczenie",
    submittingLabel: "Wysyłanie…",
    successTitle: "Dziękujemy — oświadczenie zostało zapisane",
    successBody:
      "Twoje potwierdzenie zostało zarejestrowane wraz z datą, godziną i adresem IP. Do zobaczenia na starcie!",
    requiredNotice:
      "Bez zaznaczenia wymaganych zgód nie będziemy mogli dopuścić Cię do startu.",
  },

  "team-regulations": {
    slug: "team-regulations",
    kicker: "Dokument prawny",
    title: "Regulamin Publiczny (TEAM MILE POLAND)",
    eventLine: "Dotyczy wydarzenia: {event}",
    intro: [
      "Regulamin Publiczny krajowych zawodów rankingowych ACE BATTLE RUN – TEAM MILE POLAND – TEAM–Individual Ranking. Określa zasady rejestracji, Check-in, przebiegu biegów, pomiaru czasu, protestów i odwołań, kategorii i puli nagród, a także ochrony danych osobowych.",
      "Uzupełniają go Załączniki 1–5 (harmonogramy, kategorie i pula nagród, kryteria rankingowe) — dostępne u Organizatora.",
    ],
    officialDocLabel: "Pełna treść Regulaminu Publicznego",
    fields: [],
    checkboxes: [
      {
        id: "acceptRegulations",
        required: true,
        label:
          "Zapoznałem/-am się z pełną treścią Regulaminu Publicznego serii TEAM MILE POLAND i akceptuję jego postanowienia.",
      },
    ],
    submitLabel: "Potwierdź akceptację",
    submittingLabel: "Zapisywanie…",
    successTitle: "Regulamin zaakceptowany",
    successBody: "Twoje potwierdzenie zostało zapisane. Dziękujemy!",
    requiredNotice:
      "Akceptacja Regulaminu jest warunkiem dopuszczenia do udziału w wydarzeniu.",
  },

  "team-rules": {
    slug: "team-rules",
    kicker: "Dokument techniczny",
    title: "Zasady Przeprowadzania Drużynowego Biegu Rankingowego",
    eventLine: "Dotyczy wydarzenia: {event}",
    intro: [
      "Dokument opisuje role uczestników (RACER, ACE, JOKER), skład i rodzaje drużyn, zasady przekazania AB MACE w strefie JOKER, zasady biegu i pomiaru czasu oraz sposób ustalania wyniku drużynowego i indywidualnego.",
      "Warto przeczytać go w całości przed Check-in — zawiera m.in. dokładne zasady przydziału ról i etapów dystansu.",
    ],
    officialDocLabel: "Pełna treść Zasad TEAM MILE",
    fields: [],
    checkboxes: [
      {
        id: "acceptRules",
        required: true,
        label:
          "Zapoznałem/-am się z Zasadami Przeprowadzania Drużynowego Biegu Rankingowego ACE BATTLE RUN — TEAM MILE i zobowiązuję się ich przestrzegać.",
      },
    ],
    submitLabel: "Potwierdź akceptację",
    submittingLabel: "Zapisywanie…",
    successTitle: "Zasady zaakceptowane",
    successBody: "Twoje potwierdzenie zostało zapisane. Dziękujemy!",
    requiredNotice:
      "Akceptacja Zasad jest warunkiem dopuszczenia do udziału w wydarzeniu.",
  },

  "team-rodo": {
    slug: "team-rodo",
    kicker: "Ochrona danych",
    title: "Klauzula Informacyjna RODO (Dokument nr 6)",
    eventLine: "Dotyczy wydarzenia: {event}",
    intro: [
      "Administratorem Twoich danych osobowych jest ACE BATTLE POLAND Sp. z o.o. Dane przetwarzamy w celu rejestracji, przeprowadzenia wydarzenia, pomiaru czasu i ustalenia wyników, bezpieczeństwa oraz rozpatrywania protestów — na podstawie art. 6 ust. 1 lit. b, c oraz f RODO.",
      "W publicznej tabeli wyników publikujemy wyłącznie: imię, nazwisko, czas, miejsce w rankingu, kategorię sportową oraz nazwę drużyny. Nie publikujemy PESEL, daty urodzenia, adresu, telefonu, e-maila ani danych kontaktu alarmowego.",
    ],
    officialDocLabel: "Pełna treść Klauzuli Informacyjnej RODO",
    fields: [],
    checkboxes: [
      {
        id: "acceptRodo",
        required: true,
        label:
          "Potwierdzam, że zapoznałem/-am się z Klauzulą Informacyjną RODO dla uczestników tej serii wydarzeń.",
      },
    ],
    submitLabel: "Potwierdź zapoznanie się",
    submittingLabel: "Zapisywanie…",
    successTitle: "Potwierdzenie zapisane",
    successBody: "Dziękujemy za zapoznanie się z zasadami ochrony danych.",
    requiredNotice:
      "To jest obowiązek informacyjny administratora danych — potwierdzenie zapoznania się jest wymagane przed rejestracją.",
  },
};

export const teamInternalDocumentsPl: Record<
  | "team-lia"
  | "team-potwierdzenie"
  | "team-captain"
  | "team-appendix1"
  | "team-appendix2"
  | "team-appendix3"
  | "team-appendix4"
  | "team-appendix5",
  InternalDocumentMeta
> = {
  "team-lia": {
    slug: "team-lia",
    kicker: "Dokument wewnętrzny",
    title: "Test Równowagi / LIA (Dokument nr 7) — TEAM MILE POLAND",
    intro: [
      "Wewnętrzny dokument analityczny Organizatora uzasadniający publikację wyników na podstawie prawnie uzasadnionego interesu (art. 6 ust. 1 lit. f RODO), wspólny dla całej serii TEAM MILE POLAND.",
    ],
    internalNotice:
      "Dokument wewnętrzny — widoczny wyłącznie dla administratorów i menedżerów.",
  },
  "team-potwierdzenie": {
    slug: "team-potwierdzenie",
    kicker: "Dokument wewnętrzny",
    title: "Potwierdzenie Zastosowania LIA do Wydarzenia — TEAM MILE POLAND",
    intro: [
      "Administrator potwierdza samodzielnie (nie uczestnik), że do konkretnej edycji serii TEAM MILE POLAND zastosowano obowiązujący Test Równowagi / LIA.",
    ],
    internalNotice:
      "Dokument wewnętrzny — administrator potwierdza go samodzielnie przed każdą edycją.",
  },
  "team-captain": {
    slug: "team-captain",
    kicker: "Dokument wewnętrzny",
    title: "Przepisy o Kapitanie Drużyny w Ekosystemie ACE BATTLE RUN",
    intro: [
      "Określa status, uprawnienia i obowiązki Kapitana Drużyny. Dotyczy wyłącznie osoby pełniącej tę funkcję w danej drużynie — nie jest to dokument podpisywany przez każdego uczestnika przy rejestracji.",
    ],
    internalNotice:
      "Dokument referencyjny — udostępniany Kapitanom drużyn i widoczny w panelu administratora; nie jest częścią standardowego kompletu zgód uczestnika.",
  },
  "team-appendix1": {
    slug: "team-appendix1",
    kicker: "Załącznik 1",
    title: "Harmonogram wydarzenia dla uczestników",
    intro: [
      "Szczegółowa chronologia dnia startu: rejestracja, Check-in, zbiórka w Call Roomie, starty co 15 minut, publikacja wyników.",
    ],
    internalNotice:
      "Dokument referencyjny — dostępny w panelu administratora i na życzenie uczestnika.",
  },
  "team-appendix2": {
    slug: "team-appendix2",
    kicker: "Załącznik 2",
    title: "Harmonogram wydarzenia dla organizatorów",
    intro: [
      "Wewnętrzna chronologia czynności personelu organizacyjnego i sędziowskiego w dniu wydarzenia.",
    ],
    internalNotice:
      "Dokument wewnętrzny — wyłącznie dla zespołu organizacyjnego.",
  },
  "team-appendix3": {
    slug: "team-appendix3",
    kicker: "Załącznik 3",
    title: "Kategorie i pula nagród",
    intro: [
      "Pula nagród serii (10 000 PLN), podział na kategorie (drużyny męskie/żeńskie/MIX, klasyfikacja indywidualna) oraz warunki wypłaty nagrody.",
    ],
    internalNotice:
      "Dokument referencyjny — dostępny w panelu administratora i na życzenie uczestnika.",
  },
  "team-appendix4": {
    slug: "team-appendix4",
    kicker: "Załącznik 4",
    title: "Kryteria rankingu indywidualnego",
    intro: [
      "Tabela 16 poziomów indywidualnych (INDIVIDUAL LEVEL) w podziale na płeć i rolę (RUNNERS / ACE & JOKER), stosowana do ustalania poziomu uczestnika w systemie ACE BATTLE RUN RATING.",
    ],
    internalNotice:
      "Dokument referencyjny — dostępny w panelu administratora i na życzenie uczestnika.",
  },
  "team-appendix5": {
    slug: "team-appendix5",
    kicker: "Załącznik 5",
    title: "Kryteria rankingów zespołowych",
    intro: [
      "Tabela dywizji drużyn (BEGINNER → TOP ELITE) wraz z progami czasowymi dla poszczególnych kategorii.",
    ],
    internalNotice:
      "Dokument referencyjny — dostępny w panelu administratora i na życzenie uczestnika.",
  },
};

export const registerTeamPl: DocumentContent = {
  slug: "team-oswiadczenie",
  kicker: "Rejestracja",
  title: "Zarejestruj drużynę / dołącz do biegu",
  eventLine: "ACE BATTLE RUN – TEAM MILE POLAND – TEAM–Individual Ranking",
  intro: [],
  officialDocLabel: "Przeczytaj pełne dokumenty",
  fields: teamDocumentsPl["team-oswiadczenie"]!.fields,
  checkboxes: [
    {
      id: "rulesAndRegulations",
      required: true,
      label:
        "Zapoznałem/-am się z Regulaminem Publicznym oraz Zasadami Przeprowadzania Drużynowego Biegu Rankingowego (TEAM MILE) i zobowiązuję się ich przestrzegać.",
    },
    {
      id: "ageHealthRisks",
      required: true,
      label:
        "Oświadczam, że w dniu wydarzenia mam ukończone 18 lat, biorę udział dobrowolnie, a mój stan zdrowia pozwala mi na bezpieczny udział — i świadomie przyjmuję typowe ryzyka biegu drużynowego.",
    },
    {
      id: "dataTruthfulAndRodo",
      required: true,
      label:
        "Potwierdzam prawdziwość podanych przeze mnie danych, w tym nazwy drużyny i roli, oraz zapoznałem/-am się z Klauzulą Informacyjną RODO dla tej serii wydarzeń.",
    },
    {
      id: "publicResultsAwareness",
      required: true,
      label:
        "Rozumiem, że moje imię, nazwisko, czas, miejsce w rankingu, kategoria sportowa i nazwa drużyny mogą zostać opublikowane publicznie, natomiast dane kontaktowe, adres i data urodzenia NIE są publikowane.",
    },
    {
      id: "prizeDataUnderstanding",
      required: true,
      label:
        "Rozumiem, że w przypadku zajęcia miejsca nagrodzonego wypłata nagrody wymaga podania danych do przelewu i — jeśli to niezbędne — rozliczenia podatkowego (Załącznik 3).",
    },
  ],
  imageConsent: teamDocumentsPl["team-oswiadczenie"]!.imageConsent,
  submitLabel: "Zakończ rejestrację →",
  submittingLabel: "Rejestrowanie…",
  successTitle: "Rejestracja zakończona!",
  successBody:
    "Twoje zgłoszenie i podpisane dokumenty zostały zapisane. Do zobaczenia na starcie!",
  requiredNotice:
    "Bez zaznaczenia wymaganych zgód nie będziemy mogli dopuścić Cię do startu.",
};
