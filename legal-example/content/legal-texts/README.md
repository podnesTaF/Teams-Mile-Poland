# /content/legal-texts — pełne teksty dokumentów (do wyświetlenia w serwisie)

To jest źródło treści dla przycisku **„Pełny tekst dokumentu"** widocznego
na stronach formularzy oraz w panelu administratora — czyli faktyczna
zawartość, którą uczestnik czyta na stronie, zamiast (jak wcześniej) linku
do brakującego pliku PDF.

## Skąd to się wzięło

Każdy plik `.html` w tym folderze to wyeksportowana treść z Waszych
zatwierdzonych plików `.docx` (dokładnie tych samych, których używaliśmy
przy tworzeniu dokumentów RODO/LIA/Regulaminu/Przepisów/Oświadczenia),
skonwertowana narzędziem `pandoc` (`pandoc -f docx -t html`). Zachowuje
nagłówki, pogrubienia, listy i tabele w czystym, semantycznym HTML —
bez zewnętrznych zależności JS do renderowania w przeglądarce.

## Struktura

```
content/legal-texts/
├── pl/{oswiadczenie,przepisy,rodo,regulamin,lia,potwierdzenie}.html
├── en/{oswiadczenie,przepisy,rodo,lia,potwierdzenie}.html
├── ua/{oswiadczenie,przepisy,rodo,lia,potwierdzenie}.html
└── ru/{oswiadczenie,przepisy,rodo,lia,potwierdzenie}.html
```

> **Regulamin Wydarzenia Sportowego ma na razie tylko wersję polską.**
> Jego treść merytoryczna jest już w całości zawarta w „Przepisach
> Publicznych" (dokument widoczny dla uczestnika), więc w wersjach
> EN/UA/RU nie było osobnego tłumaczenia. Dokument jest teraz i tak
> wyłącznie wewnętrzny (patrz `app/admin/documents/[doc]`) — jeśli mimo
> to potrzebujecie tłumaczeń dla anglo-/ukraińsko-/rosyjskojęzycznych
> menedżerów, dogenerujcie je tą samą metodą (patrz niżej) z gotowego
% tłumaczenia .docx.

`lib/legal-texts.ts` ma wbudowany fallback: jeśli plik dla danego języka
nie istnieje, pokazuje polską wersję z dyskretną notatką "brak tłumaczenia".

## Jak zregenerować po aktualizacji dokumentów

Jeśli prawnik zaktualizuje któryś z plików `.docx`, podmieńcie plik
źródłowy i odpalcie ponownie (wymaga zainstalowanego `pandoc`):

```bash
pandoc -f docx -t html --wrap=none "ŚCIEŻKA/DO/Dokument.docx" \
  -o content/legal-texts/{lang}/{doc}.html
```

gdzie `{lang}` to `pl`/`en`/`ua`/`ru`, a `{doc}` to jeden z:
`oswiadczenie`, `przepisy`, `rodo`, `regulamin`, `lia`, `potwierdzenie`.

## Stylowanie

HTML jest wstrzykiwany przez `dangerouslySetInnerHTML` wewnątrz kontenera
z klasą `.legal-prose` (patrz `app/globals.css`) — tam znajdują się
wszystkie reguły typografii (nagłówki, tabele, listy) oraz style do druku
(`@media print`) używane w panelu administratora przy drukowaniu
podpisanych oświadczeń.

**Bezpieczeństwo:** treść pochodzi wyłącznie z zaufanych, wewnętrznych
plików `.docx` przygotowywanych przez zespół/prawnika — nigdy nie
wstrzykujemy w ten sposób treści pochodzącej od użytkownika (uczestnika).

## Tokeny automatycznego wypełniania (WAŻNE)

`oswiadczenie.html` i `rodo.html` (wszystkie 4 języki) zawierają ręcznie
wstawione tokeny zamiast sztywnych dat i pustych linii do wypełnienia:

| Token | Co podstawia | Kiedy |
|---|---|---|
| `__EVENT_DATE__` | Data WYBRANEGO wydarzenia | Już na stronie `/read` |
| `__SIGN_DATE__` | Faktyczna data podpisania (dzień wysłania formularza) | Dopiero po podpisaniu (panel admina) |
| `__DOC_VERSION_DATE__` | Stała data przygotowania samej klauzuli RODO (nie zależy od edycji) | Zawsze |
| `__FULL_NAME__`, `__BIRTH_DATE__`, `__PHONE_EMAIL__`, `__ADDRESS__`, `__EMERGENCY_CONTACT__` | Dane uczestnika | Dopiero po podpisaniu (panel admina) |

Logika podstawiania: `lib/fill-legal-template.ts`. Przed podpisaniem
(strona `/read`) tokeny danych uczestnika i `__SIGN_DATE__` pokazują
pustą linię (`.fill-blank` w CSS) — dokument jeszcze nie jest podpisany.

**Jeśli regenerujecie `.html` z nowej wersji `.docx` (patrz sekcja wyżej),
te tokeny zostaną nadpisane oryginalnym tekstem `.docx`** (wróci sztywne
`29.08.2026` i puste linie) — trzeba je ręcznie rozstawić ponownie w tych
samych miejscach, albo poprosić nas o ponowne uruchomienie skryptu
tokenizującego.
