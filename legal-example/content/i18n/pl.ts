import type { CommonDictionary } from "../types";
import { teamDocumentsPl, teamInternalDocumentsPl, registerTeamPl } from "./team-pl";

export const pl: CommonDictionary = {
  localeName: "Polski",
  siteName: "ACE BATTLE RUN — Warszawa",
  nav: {
    home: "Strona główna",
    register: "Zarejestruj się",
    documents: "Dokumenty uczestnika",
    terms: "Regulamin i warunki",
    contact: "Kontakt",
  },
  hub: {
    kicker: "Przed startem",
    title: "Dokumenty uczestnika wydarzenia",
    subtitle:
      "Zanim staniesz na starcie, potwierdź poniższe dokumenty. Zajmie to około 5 minut — dane wydarzenia (data, miejsce) uzupełniają się automatycznie.",
    cardCta: "Otwórz i podpisz →",
  },
  eventCard: {
    label: "Wydarzenie, którego dotyczy ten formularz",
    dateLabel: "Data",
    venueLabel: "Miejsce",
    entryLabel: "Udział",
    entryFree: "Bezpłatny",
    statusOpen: "Zapisy otwarte",
    statusSoon: "Wkrótce",
    statusClosed: "Zapisy zamknięte",
    statusFinished: "Zakończone",
    switchEvent: "To nie ta edycja? Wybierz inną",
  },
  form: {
    requiredMark: "Pola oznaczone * są obowiązkowe",
    requiredHint: "wymagane",
    readFullDocument: "Pełna treść dokumentu",
    readFullDocumentCta: "Otwórz pełny tekst →",
    fallbackNotice:
      "Tłumaczenie na ten język nie jest jeszcze dostępne — poniżej wersja polska.",
    errorRequired: "To pole jest wymagane.",
    errorGeneric: "Popraw zaznaczone pola i spróbuj ponownie.",
    backToDocuments: "← Wszystkie dokumenty",
    backToForm: "← Wróć do formularza",
    print: "Drukuj",
  },
  footer: {
    rights: "Wszystkie prawa zastrzeżone.",
    organizer: "Organizator: ACE BATTLE POLAND Sp. z o.o., Warszawa",
    termsLink: "Polityka prywatności i Regulamin serwisu",
  },
  documents: {
    oswiadczenie: {
      slug: "oswiadczenie",
      kicker: "Dokument główny",
      title: "Oświadczenie Uczestnika Wydarzenia",
      eventLine: "Dotyczy wydarzenia: {event}",
      intro: [
        "To najważniejszy formularz przed startem: potwierdzasz w nim swoje dane, pełnoletność i stan zdrowia, świadomie przyjmujesz typowe ryzyka biegu ulicznego oraz zapoznajesz się z zasadami publikacji wyników.",
        "Wypełnij wszystkie pola oznaczone gwiazdką i zaznacz wymagane zgody. Pozostałe checkboxy dotyczą sytuacji, które mogą Cię nie dotyczyć (np. dane do wypłaty nagrody) — zaznacz je, jeśli je rozumiesz i akceptujesz.",
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
          name: "bankAccount",
          label: "Numer rachunku bankowego",
          required: false,
          type: "text",
          conditional: "prizeWinner",
          helpText:
            "Wypełnij tylko, jeśli zająłeś/-aś miejsce nagrodzone (§ 7A Regulaminu). Nie jest wymagane przy zwykłej rejestracji.",
        },
        {
          name: "taxId",
          label: "PESEL lub NIP (do rozliczenia podatkowego nagrody)",
          required: false,
          type: "text",
          conditional: "prizeWinner",
          helpText:
            "Wymagane wyłącznie przy nagrodzie pieniężnej przekraczającej 2000 PLN — zgodnie z art. 30 ust. 1 pkt 2 ustawy o PIT.",
        },
      ],
      checkboxes: [
        {
          id: "ageAndHealth",
          required: true,
          label:
            "Oświadczam, że w dniu wydarzenia mam ukończone 18 lat, biorę udział dobrowolnie, a według mojej najlepszej wiedzy mój stan zdrowia pozwala mi na bezpieczny udział w biegu.",
        },
        {
          id: "risks",
          required: true,
          label:
            "Rozumiem i świadomie przyjmuję typowe ryzyka udziału w zawodach biegowych (upadek, zderzenie, poślizgnięcie, odwodnienie, urazy mięśni i stawów, niekorzystne warunki pogodowe i inne), w zakresie niewynikającym z winy Organizatora.",
        },
        {
          id: "rulesAndInstructions",
          required: true,
          label:
            'Zapoznałem/-am się z zasadami wydarzenia ("Przepisy publiczne na Krajowej Indywidualnej Mili Rankingowej") lub miałem/-am realną możliwość się z nimi zapoznać, i zobowiązuję się przestrzegać trasy oraz poleceń Organizatora, sędziów i służb.',
        },
        {
          id: "rodoRead",
          required: true,
          label:
            "Otrzymałem/-am lub miałem/-am możliwość zapoznania się z Klauzulą Informacyjną RODO dla uczestników wydarzenia.",
        },
        {
          id: "publicResults",
          required: true,
          label:
            "Zostałem/-am poinformowany/-a, że moje imię, nazwisko, czas biegu, miejsce w rankingu oraz kategoria sportowa mogą zostać opublikowane publicznie na stronie wydarzenia, bez konieczności logowania.",
        },
        {
          id: "sensitiveDataNotPublished",
          required: true,
          label:
            "Rozumiem, że dane kontaktowe, adres, data urodzenia, dane osoby do kontaktu w nagłym wypadku oraz dane dotyczące zdrowia NIE są przeznaczone do publikacji w tabeli wyników.",
        },
        {
          id: "prizeDataUnderstanding",
          required: true,
          label:
            "Rozumiem, że w przypadku zajęcia miejsca nagrodzonego wypłata nagrody wymaga podania danych do przelewu i — jeśli to niezbędne — rozliczenia podatkowego (zob. § 7A Regulaminu).",
        },
        {
          id: "accuracyOfData",
          required: true,
          label:
            "Potwierdzam prawdziwość podanych przeze mnie danych oraz dobrowolny charakter mojego udziału w wydarzeniu.",
        },
      ],
      imageConsent: {
        question: "Wizerunek, zdjęcia i nagrania — odrębna dobrowolna zgoda",
        agreeLabel:
          "WYRAŻAM ZGODĘ na wykorzystywanie i rozpowszechnianie mojego indywidualnie rozpoznawalnego wizerunku utrwalonego podczas wydarzenia w materiałach informacyjnych, sprawozdawczych i promocyjnych Organizatora (strona internetowa, media społecznościowe), bez odrębnego wynagrodzenia. Zgodę mogę wycofać na przyszłość w dowolnym momencie.",
        agreeNote: "Zgoda dobrowolna — możesz ją wycofać w każdej chwili.",
        disagreeLabel:
          "NIE WYRAŻAM ZGODY na wykorzystywanie mojego indywidualnie rozpoznawalnego wizerunku na podstawie dobrowolnej zgody.",
        disagreeNote:
          "Brak zgody nie wpływa na Twoje prawo udziału w wydarzeniu. Wizerunek osoby stanowiącej jedynie szczegół całości (np. tłumu na imprezie publicznej) może być rozpowszechniany bez odrębnej zgody na podstawie art. 81 ustawy o prawie autorskim i prawach pokrewnych.",
      },
      submitLabel: "Podpisz i wyślij oświadczenie",
      submittingLabel: "Wysyłanie…",
      successTitle: "Dziękujemy — oświadczenie zostało zapisane",
      successBody:
        "Twoje potwierdzenie zostało zarejestrowane wraz z datą, godziną i adresem IP jako dowód złożenia oświadczenia. Do zobaczenia na starcie!",
      requiredNotice:
        "Bez zaznaczenia wymaganych zgód nie będziemy mogli dopuścić Cię do startu.",
    },
    przepisy: {
      slug: "przepisy",
      kicker: "Dokument techniczny",
      title:
        "Przepisy Publiczne na Krajowej Indywidualnej Mili Rankingowej",
      eventLine: "Dotyczy wydarzenia: {event}",
      intro: [
        "Ten dokument opisuje przebieg zawodów: rejestrację i odprawę, harmonogram dnia wyścigu, sloty startowe, zasady biegu i pomiaru czasu, kategorie klasyfikacji, procedurę protestów oraz szczegóły funduszu nagród.",
        "Warto przeczytać go w całości przed startem — zawiera m.in. dokładne godziny zamknięcia rejestracji i zasady dyskwalifikacji.",
      ],
      officialDocLabel: "Pełna treść Przepisów Publicznych",
      fields: [
        {
          name: "fullName",
          label: "Imię i nazwisko uczestnika",
          placeholder: "Jan Kowalski",
          required: true,
          type: "text",
        },
      ],
      checkboxes: [
        {
          id: "acceptPrzepisy",
          required: true,
          label:
            "Zapoznałem/-am się z Przepisami Publicznymi na Krajowej Indywidualnej Mili Rankingowej i zobowiązuję się ich przestrzegać.",
        },
      ],
      submitLabel: "Potwierdź akceptację",
      submittingLabel: "Zapisywanie…",
      successTitle: "Przepisy zaakceptowane",
      successBody: "Twoje potwierdzenie zostało zapisane. Dziękujemy!",
      requiredNotice:
        "Akceptacja Przepisów jest warunkiem dopuszczenia do udziału w wydarzeniu.",
    },
    rodo: {
      slug: "rodo",
      kicker: "Ochrona danych",
      title: "Klauzula Informacyjna RODO dla uczestników wydarzenia",
      eventLine: "Dotyczy wydarzenia: {event}",
      intro: [
        "Administratorem Twoich danych osobowych jest ACE BATTLE POLAND Sp. z o.o. Dane przetwarzamy w celu rejestracji, przeprowadzenia wydarzenia, pomiaru czasu i ustalenia wyników, bezpieczeństwa oraz rozpatrywania protestów — na podstawie art. 6 ust. 1 lit. b, c oraz f RODO.",
        "W publicznej tabeli wyników publikujemy wyłącznie: imię, nazwisko, czas biegu, miejsce w rankingu i kategorię sportową. Nie publikujemy PESEL, daty urodzenia, adresu, telefonu, e-maila, danych kontaktu alarmowego ani informacji o zdrowiu.",
        "Przysługuje Ci prawo dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, sprzeciwu (art. 21 RODO) oraz wniesienia skargi do Prezesa UODO.",
      ],
      officialDocLabel: "Pełna treść Klauzuli Informacyjnej RODO",
      fields: [
        {
          name: "fullName",
          label: "Imię i nazwisko uczestnika",
          placeholder: "Jan Kowalski",
          required: true,
          type: "text",
        },
      ],
      checkboxes: [
        {
          id: "acceptRodo",
          required: true,
          label:
            "Potwierdzam, że zapoznałem/-am się z Klauzulą Informacyjną RODO dla uczestników wydarzenia.",
        },
      ],
      submitLabel: "Potwierdź zapoznanie się",
      submittingLabel: "Zapisywanie…",
      successTitle: "Potwierdzenie zapisane",
      successBody: "Dziękujemy za zapoznanie się z zasadami ochrony danych.",
      requiredNotice:
        "To jest obowiązek informacyjny administratora danych — potwierdzenie zapoznania się jest wymagane przed rejestracją.",
    },
    ...teamDocumentsPl,
  },
  register: {
    slug: "oswiadczenie",
    kicker: "Rejestracja",
    title: "Zarejestruj się na bieg",
    eventLine: "Jedna mila. Jeden wynik. Twój poziom.",
    intro: [],
    officialDocLabel: "Przeczytaj pełne dokumenty",
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
        name: "bankAccount",
        label: "Numer rachunku bankowego",
        required: false,
        type: "text",
        conditional: "prizeWinner",
        helpText:
          "Wypełnij tylko, jeśli zająłeś/-aś miejsce nagrodzone (§ 7A Regulaminu). Nie jest wymagane przy zwykłej rejestracji.",
      },
      {
        name: "taxId",
        label: "PESEL lub NIP (do rozliczenia podatkowego nagrody)",
        required: false,
        type: "text",
        conditional: "prizeWinner",
        helpText:
          "Wymagane wyłącznie przy nagrodzie pieniężnej przekraczającej 2000 PLN — zgodnie z art. 30 ust. 1 pkt 2 ustawy o PIT.",
      },
    ],
    checkboxes: [
      {
        id: "rulesAndRegulations",
        required: true,
        label:
          'Zapoznałem/-am się z zasadami wydarzenia ("Przepisy Publiczne") i zobowiązuję się przestrzegać trasy oraz poleceń Organizatora, sędziów i służb bezpieczeństwa.',
      },
      {
        id: "ageHealthRisks",
        required: true,
        label:
          "Oświadczam, że w dniu wydarzenia mam ukończone 18 lat, biorę udział dobrowolnie, a mój stan zdrowia pozwala mi na bezpieczny udział — i świadomie przyjmuję typowe ryzyka biegu ulicznego (upadek, zderzenie, odwodnienie, urazy i inne).",
      },
      {
        id: "dataTruthfulAndRodo",
        required: true,
        label:
          "Potwierdzam prawdziwość podanych przeze mnie danych oraz zapoznałem/-am się z Klauzulą Informacyjną RODO dla uczestników wydarzenia.",
      },
      {
        id: "publicResultsAwareness",
        required: true,
        label:
          "Rozumiem, że moje imię, nazwisko, czas biegu, miejsce w rankingu i kategoria sportowa mogą zostać opublikowane publicznie, natomiast dane kontaktowe, adres, data urodzenia i informacje o zdrowiu NIE są publikowane.",
      },
      {
        id: "prizeDataUnderstanding",
        required: true,
        label:
          "Rozumiem, że w przypadku zajęcia miejsca nagrodzonego wypłata nagrody wymaga podania danych do przelewu i — jeśli to niezbędne — rozliczenia podatkowego (§ 7A Regulaminu).",
      },
    ],
    imageConsent: {
      question: "Wizerunek, zdjęcia i nagrania — odrębna dobrowolna zgoda",
      agreeLabel:
        "WYRAŻAM ZGODĘ na wykorzystywanie i rozpowszechnianie mojego indywidualnie rozpoznawalnego wizerunku utrwalonego podczas wydarzenia w materiałach informacyjnych, sprawozdawczych i promocyjnych Organizatora (strona internetowa, media społecznościowe), bez odrębnego wynagrodzenia. Zgodę mogę wycofać na przyszłość w dowolnym momencie.",
      agreeNote: "Zgoda dobrowolna — możesz ją wycofać w każdej chwili.",
      disagreeLabel:
        "NIE WYRAŻAM ZGODY na wykorzystywanie mojego indywidualnie rozpoznawalnego wizerunku na podstawie dobrowolnej zgody.",
      disagreeNote:
        "Brak zgody nie wpływa na Twoje prawo udziału w wydarzeniu. Wizerunek osoby stanowiącej jedynie szczegół całości (np. tłumu na imprezie publicznej) może być rozpowszechniany bez odrębnej zgody na podstawie art. 81 ustawy o prawie autorskim i prawach pokrewnych.",
    },
    submitLabel: "Zakończ rejestrację →",
    submittingLabel: "Rejestrowanie…",
    successTitle: "Rejestracja zakończona!",
    successBody:
      "Twoje zgłoszenie i podpisane dokumenty zostały zapisane. Do zobaczenia na starcie!",
    requiredNotice:
      "Bez zaznaczenia wymaganych zgód nie będziemy mogli dopuścić Cię do startu.",
  },
  registerTeam: registerTeamPl,
  internalDocuments: {
    regulamin: {
      slug: "regulamin",
      kicker: "Dokument wewnętrzny",
      title: "Regulamin Wydarzenia Sportowego",
      intro: [
        "Nadrzędny dokument prawny cyklu Ace Battle Run Polska — Kwalifikacja na jedną milę. Jego postanowienia dotyczące uczestników (warunki udziału, RODO, wizerunek, fundusz nagród § 7A, odpowiedzialność) są już w całości odzwierciedlone w „Przepisach Publicznych”, które uczestnik podpisuje przy rejestracji — dlatego ten dokument nie jest pokazywany osobno na formularzu uczestnika.",
        "Zachowany tutaj jako dokument referencyjny na wypadek kontroli, sporu lub aktualizacji Przepisów Publicznych.",
      ],
      internalNotice:
        "Dokument wewnętrzny — widoczny wyłącznie dla administratorów i menedżerów. Uczestnicy go nie widzą i niczego w nim nie podpisują.",
    },
    lia: {
      slug: "lia",
      kicker: "Dokument wewnętrzny",
      title:
        "Test Równowagi / Legitimate Interest Assessment (LIA) — publiczne udostępnianie wyników",
      intro: [
        "Wewnętrzny dokument analityczny Organizatora uzasadniający, dlaczego publiczna publikacja wyników zawodów (imię, nazwisko, czas, miejsce) odbywa się na podstawie prawnie uzasadnionego interesu Organizatora (art. 6 ust. 1 lit. f RODO), a nie zgody uczestnika.",
        "Dokument wspólny dla całej serii wydarzeń 2026 — nie jest przypisany do jednej edycji.",
      ],
      internalNotice:
        "Dokument wewnętrzny — widoczny wyłącznie dla administratorów i menedżerów. Nie jest i nie powinien być pokazywany uczestnikom.",
    },
    potwierdzenie: {
      slug: "potwierdzenie",
      kicker: "Dokument wewnętrzny",
      title: "Potwierdzenie Zastosowania LIA do Wydarzenia",
      intro: [
        "Krótki formularz, którym administrator potwierdza samodzielnie (nie uczestnik), że do konkretnej edycji wydarzenia zastosowano obowiązujący Test Równowagi / LIA oraz że sposób publikacji wyników jest z nim zgodny.",
        "Wypełniany i archiwizowany wewnętrznie dla każdej edycji cyklu.",
      ],
      internalNotice:
        "Dokument wewnętrzny — administrator potwierdza go samodzielnie przed każdą edycją. Uczestnik nie ma z nim kontaktu.",
    },
    ...teamInternalDocumentsPl,
  },
};
