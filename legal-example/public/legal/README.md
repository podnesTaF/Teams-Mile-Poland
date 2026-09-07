# /public/legal — UWAGA: ta ścieżka nie jest już używana przez aplikację

Wcześniejsza wersja formularzy linkowała tutaj (`/legal/{lang}/{doc}.pdf`)
do pobrania PDF-a z pełną treścią dokumentu. Zostało to zastąpione
wbudowanym czytaniem pełnego tekstu wprost na stronie:

- Uczestnik: `/{lang}/documents/{doc}/read` — renderuje gotowy HTML
  z `content/legal-texts/{lang}/{doc}.html` (patrz README w tamtym
  folderze — tam też instrukcja regeneracji po aktualizacji dokumentu).
- Administrator: `/admin/documents/{doc}` dla dokumentów wewnętrznych
  (regulamin, lia, potwierdzenie).

Ten folder (`public/legal/`) zostawiliśmy na wypadek, gdybyście jednak
chcieli DODATKOWO udostępnić pobieranie PDF (np. do druku/archiwizacji
poza stroną) — wtedy można tu wgrać pliki i dodać przycisk „Pobierz PDF”
obok istniejącego przycisku „Otwórz pełny tekst” w
`app/[lang]/documents/[doc]/page.tsx`. Nie jest to jednak wymagane do
działania formularzy.
