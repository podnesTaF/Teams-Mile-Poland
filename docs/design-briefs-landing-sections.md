# Design briefs — six new landing sections for poland.acebattle.run

Source: Go Marketing AI strategy for ACE BATTLE POLAND (11.09.2026), sections 5–10 of the website blueprint.
Audience for this file: Claude Design. Each brief gives the marketing goal, the exact content, the proof that must appear, and the data source. Layout and visual treatment are the designer's call.

## Shared context (read once)

**Product.** One-mile (1609 m, 4 stadium laps) team-and-individual rating races at Stadion Podskarbińska, ul. Chrzanowskiego 23, Warszawa. Chip timing by RaceResult. Runners get an official time, a Level (one of 16) and a place in the national ranking. Teams of 7 + 4 reserves play ACE BATTLE MILE matches with roles Racer (3), Ace (2), Joker (2). Governing body: ABA (aba.run). First Warsaw qualifier free; then 10 € per runner.

**Season 2026.** Rating races 22.09, 01.10, 10.10. ACE BATTLE MILE matches 17.10. Final and awards 24.10.

**Audience and objections these sections must answer.**
- Igor, 18–35 amateur runner from Facebook/Instagram: "I don't understand what this event is", "I don't want to be first", "cool but not for me", "why is it free, where's the catch".
- Maksym, captain of a running club: "if the format is raw, my reputation takes the hit".
- Anna, 18–35 woman who runs or does fitness: "will I be the only woman there", "I'll be the slowest and results are public".

**Tone rules from the strategy.** First sentence is always distance, action and result in numbers. Never use: "nowy format biegów", "debiut", "unikalny", "innowacyjny", "ekosystem", "token", "zarabiaj na bieganiu", "dołącz do ruchu". Proof beats adjectives: every claim sits next to a number, a date or a link that can be checked in a minute.

**Brand.** Light background `#ffffff` / `#f5f5f3`, ink `#070707`, signature red `#d23a33` (hot `#e51f32`) used sparingly for emphasis and CTAs. Display type Exo 2 (headlines, 700–900), Fira Sans Condensed (sub-headlines), body Manrope/Inter, mono JetBrains Mono for times and numbers. Existing sections use red `<red>` emphasis inside black headlines and uppercase kickers. Mobile first, 400 px must work.

**Language.** Primary copy Polish. Every string will be added to `src/messages/pl.json`, `en.json`, `ua.json`, so keep copy short and avoid text baked into images.

---

## Brief 5 — Trust block: "Dlaczego można nam zaufać"

**Marketing goal.** Kill the objection "I don't want to be first / I don't know the organiser". Today the trust signals (ABA, RaceResult, medical team, chip timing) are scattered across four sections and therefore do not register. Collect them into one block a visitor can scan in ten seconds and verify online in one minute. Factor score in the strategy: importance 8/10, current delivery 4/10.

**Position on page.** After the mechanic section (brief 8) and before the price block (brief 6). It should also be reusable as a compact strip on the captain page later.

**Content (Polish copy).**
- Kicker: `ZAUFANIE`
- Headline: `Dlaczego można nam zaufać`
- Sub-line: `Wszystko poniżej można sprawdzić online w ciągu minuty.`

Six proof items, each with one short label, one fact and one verifiable link or document where available:
1. **Organ władający** — logo ABA, `Międzynarodowe Stowarzyszenie Ace Battle`, link `aba.run`. Sentence: `Zawody odbywają się według standardów ABA.`
2. **Licencja** — `Licencja ABA dla ACE BATTLE POLAND LTD` with number, date and validity period (placeholders `[nr]`, `[data]`, `[ważna do]`). Link or thumbnail to the licence extract PDF. This is the strongest unused proof in the strategy; give it weight equal to the ABA logo.
3. **Ponad 4 lata** — `Ponad 4 lata zawodów w różnych krajach.`
4. **Warszawa, sierpień 2026** — `5 biegów · ~120 osób na stadionie · ~100 oficjalnych wyników`. The results count is live: computed from the `event_results` table, not hardcoded. Design the number as a dynamic figure that can grow (3-digit now, 4-digit later).
5. **Wyniki publiczne** — `Każdy wynik z imieniem i czasem w RaceResult`, link to `https://my.raceresult.com/groups/7553/` and to the site's own `/rating`.
6. **Bezpieczeństwo** — `Chip-pomiar czasu RaceResult · Zespół medyczny · Profesjonalny stadion · Strefa kibica`, address `Stadion Podskarbińska, ul. Chrzanowskiego 23`.

Optional footer line: `4 team-liderów już zbiera drużyny według rankingu — napisz bezpośrednio` with a link to the contact section. (Names and photos of the team leaders come later in a separate "team and organiser" section; leave a slot.)

**Must not include.** Sponsor promises, future participant numbers (1000 runners, 48 teams), the word "debiut".

**Data sources.** Results count and race count: `event_results` / `events` tables. RaceResult URL: `src/lib/events/types.ts`. Venue facts: `src/lib/marketing/event.ts`. ABA mark already in `public/brand/aba-white` (white variant only; a dark variant may be needed on light background).

---

## Brief 6 — Price block: "Dlaczego bezpłatnie i za co 10 €"

**Marketing goal.** Close "why is it free, where is the catch". The current hero says `Udział BEZPŁATNY` next to a 10 000 zł prize fund with no explanation, which reads as suspicious and devalues the event. Explain the economics honestly, show what the paid entry contains, and anchor the price against the market. Factor: price transparency, importance 7/10, delivery 3/10.

**Position on page.** Directly after the trust block. Close to a registration CTA.

**Content (Polish copy).** Two columns, equal weight.

Left column — `Dlaczego pierwszy qualifier jest bezpłatny`
- `Ace Battle dopiero wchodzi na polski rynek. Płacimy za Twoje pierwsze doświadczenie.`
- `Bezpłatna rejestracja — dla pierwszych 300 uczestników. Zostało [N].` The `[N]` is the live counter from the existing counters API; reuse the same number as in the season calendar (brief 7).
- `Potem udział kosztuje 10 € od zawodnika — i już wiesz, za co płacisz.`

Right column — `Co wchodzi w 10 €`
- `Start na profesjonalnym stadionie`
- `Chip RaceResult ze statystyką na dystansie`
- `Profesjonalne zdjęcia i wideo`
- `Pakiet startowy (skarpetki, czekolada)`
- `Pula nagród dzielona na wszystkich uczestników`
- `Punkty rankingowe sezonu`

Full-width line under both columns, set in mono type as a comparison strip:
`HYROX ~1000 zł · zawody CrossFit 100–500 zł · imprezy biegowe 0–1000 zł · Ace Battle 10 €`

Guarantee sentence, visually distinct (box or rule), verbatim:
`Pulę nagród gwarantują osobiście organizatorzy — jest wypłacana nawet bez ani jednego podpisanego sponsora. Pakiety sponsorskie ją tylko powiększają.`

Small print row: `Utworzenie drużyny przez kapitana — 100 ACER (1 ACER = 1 USD). Warunki określa regulamin — publikacja [data].` Keep this row easy to remove; it is blocked until the regulations are published.

**Copy rules.** Say "ACER" or "kredyt ACER", never "token". Do not put the word BEZPŁATNY in the headline; the headline explains, it does not shout.

**Open facts to confirm before final copy.** Prize fund: strategy says 5 000 zł, site says 10 000 zł. Paid price: strategy says 10 €, code says 50 zł. Design with placeholders `[kwota]`.

**Data sources.** Free-tier and slot counter: `src/lib/marketing/event.ts` (`freeTier`), `src/app/api/counters/route.ts`, hook `src/features/registration/use-live-counters.ts`. Unused components `scarcity-panel` and `slot-badge` in `src/components/marketing/` can be a starting point.

---

## Brief 7 — Season calendar with deadline: "Sezon 2026"

**Marketing goal.** Create a reason to act now. Regular races plus free entry together remove urgency ("I'll catch the next one"). The strategy rates early-entry advantage importance 8/10, delivery 2/10. Show that points accumulate across the season, that September entrants can run all three rating races, and how many free places remain.

**Position on page.** Replaces or upgrades the current "Cykl biegów na milę indywidualnie" event list near the top, or sits right after the price block. It must be reachable from the header nav item `PROGRAM`.

**Content (Polish copy).**
- Kicker: `SEZON 2026`
- Headline: `Punkty naliczają się przez cały sezon`
- Sub-line: `Kto startuje we wrześniu — łapie wszystkie trzy biegi rankingowe i wchodzi do pierwszych drużyn. Kto w październiku — goni.`

Five dated milestones, in order, each with a type label and a status (open / full / done):
1. `22.09` — `Bieg rankingowy` — individual and team
2. `01.10` — `Bieg rankingowy`
3. `10.10` — `Bieg rankingowy`
4. `17.10` — `Mecze ACE BATTLE MILE`
5. `24.10` — `Finał i nagrody`

Every milestone: venue line `Stadion Podskarbińska, ul. Chrzanowskiego 23`, hours `09:00–15:30`, and a per-event link to `/events/[slug]`. Past events switch to a `Wyniki →` link.

Counter panel beside or under the timeline:
`Bezpłatna rejestracja — dla pierwszych 300 uczestników. Zostało [N]. Potem 10 €.`
Primary CTA: `Zarejestruj się na 22.09 →`. Secondary: `Zostań kapitanem drużyny` (links to the future `/captain` page; use `/teams/new` until it exists).

**Rules.** The counter is honest: it reads the real number. Never show a fake countdown or an inflated "places left". No "300" anywhere as a condition for teams to start; teams are already forming.

**Data sources.** Events, dates, slot fullness: `events` table via `src/lib/events/store.ts`, client island `src/features/event-registration/components/series-list.tsx` already renders live fullness. Counter: same as brief 6.

---

## Brief 8 — Mechanic section: "Bieg stał się grą"

**Marketing goal.** Show the one thing no competitor (HYROX, marathons, Runmageddon, CrossFit) has: the Joker rule and tactical substitutions. Strategy rates differentiation 10/10 and current delivery 5/10. The current three role cards list the roles but never explain why the game is tactical. This section must make a first-time visitor understand the mechanic in under a minute and want to try it.

**Position on page.** Before the current `Role w drużynie` cards, which then act as a detail follow-up, or replacing them entirely.

**Content (Polish copy).**
- Kicker: `MECHANIKA`
- Headline: `Bieg stał się grą. Biegacze stali się graczami.`
- Lead: `Jak w pokerze — Joker może zmienić bieg gry w każdej sekundzie. Wygrywa nie najszybszy, a najmądrzejszy.`

Four numbered facts, each one sentence, designed as steps or a schematic:
1. `Dwie drużyny na bieżni, dystans jedna mila.`
2. `Skład: 3 Racer · 2 Ace · 2 Joker.`
3. `Joker stoi w specjalnym korytarzu i może zastąpić każdego partnera w dowolnej sekundzie — nawet przed metą.`
4. `Wygrywa nie najszybszy skład, a ten, kto dobrze zdecydował, kiedy wprowadzić Jokera.`

Supporting strip, three items:
- `16 poziomów kwalifikacji — drużyna powstaje z biegaczy zbliżonego poziomu. Nowicjusz nie biegnie przeciw zawodowcowi.`
- `Jedna mila jako wejście — 4 okrążenia stadionu, krócej niż jakikolwiek bieg w parku.`
- `Live tracking i tablica — decyzje taktyczne zapadają w trakcie, na podstawie międzyczasów.`

Media slot: a schematic of the track with two teams and the Joker corridor (the strategy asks for a diagram, not a photo), plus an optional 15–30 s clip of a real Battle. Link: `Pełne zasady na aba.run →`.

CTA: `Sprawdź, kim jesteś: Racer, Ace czy Joker? →` (quiz, later; design the button, target can be the registration for now).

**Rules.** Do not lead with division names, league tiers or 16 levels as jargon; the schematic explains, the words stay short. Keep the existing red for the Joker to make it the visual hero.

**Data sources.** Static copy only. Existing role cards in `src/components/landing/roles.tsx` and their strings under `landing.roles`.

---

## Brief 9 — Women's section: "Szukamy 110 biegaczek"

**Marketing goal.** Bring roughly 110 women so the women's and mixed divisions can form. Current participant split is 70/30 men to women, and generic creatives make women self-disqualify ("cool but not for me", "are there even girls there"). The section must make a woman see herself in the event and feel sought after, not tolerated. Factor: mixed and women's team option, importance 6/10, delivery 2/10.

**Position on page.** After the mechanic or 16-levels content and before the atmosphere and testimonials. It also becomes the landing target of the separate women's paid campaign, so it needs an anchor (`#biegaczki`).

**Content (Polish copy).**
- Kicker: `DLA BIEGACZEK`
- Headline: `Szukamy 110 biegaczek, żeby zebrać drużyny damskie i mix pierwszego sezonu w Polsce.`
- Sub-line: `Mila to 4 okrążenia. Przyjdź sama albo z koleżanką — zapiszemy was razem.`

Four assurance points:
- `Osobna klasyfikacja kobiet i dywizja mix — Twój wynik porównujemy z wynikami kobiet.`
- `16 poziomów — drużyna powstaje z biegaczek w Twoim tempie.`
- `Nie masz z kim iść — zapisz się z koleżanką; nie masz koleżanki — po biegu dobierzemy Cię do drużyny.`
- `Na stadionie zespół medyczny, strefa kibica i kawiarnia. Przygotowanie specjalne nie jest potrzebne.`

Proof panel: `Tak biegły dziewczyny w sierpniu` — a list of real women's results from the August race nights: name, time, level, race date. Pulled live from the F result board, not hardcoded. Show a range of times, not only the fastest; the strategy explicitly wants mid-table times visible so the section says "there is room at your level". Photos of real August participants, not stock.

CTA: `Zapisz się z koleżanką na 22.09 →` and secondary `Zobacz wyniki kobiet →` linking to `/rating` filtered to women.

**Rules.** No combat vocabulary ("walka", "bitwa" as emphasis), no exclusively male imagery, no "bądź pierwsza" without examples of other women. Show at least one woman from the lower half of the results table.

**Data sources.** Women's board from `event_results` (the site already renders M/F tabs in `src/components/landing/results.tsx`); team categories `women`/`mixed` in `src/features/teams/config.ts`; galleries via `event_media`.

---

## Brief 10 — Testimonials: "Co mówią ci, którzy już przebiegli"

**Marketing goal.** Prove "you are not the first" with real people, names and protocol times. Nothing like this exists on the site today. The strategy asks for 5–7 short video quotes, each signed with the runner's name and the actual time from the results protocol, including at least two women and one runner from the lower half of the table.

**Position on page.** After the atmosphere carousel and before the trust block or final CTA. Also reusable on the captain page and in the women's section.

**Content (Polish copy).**
- Kicker: `UCZESTNICY`
- Headline: `Co mówią ci, którzy już przebiegli`
- Sub-line: `Każdy podpisany imieniem i czasem z protokołu.`

Card content for each testimonial:
- 20–30 s video (YouTube-nocookie, same lightbox pattern as the existing `video-play` component) or a still portrait with a text quote as fallback.
- One quote, max two sentences, in the runner's own words.
- Signature line in mono type: `Imię Nazwisko · 05:12 · Poziom 12 · 29.08.2026`.
- Optional tag: `startowała solo`, `kapitan`, `pierwszy bieg` — these map to the objections the quote answers.

Provide a layout for 5–7 cards that also works with 3 while content is being gathered, and a placeholder state that does not look empty (for example a single card plus a "więcej po 22.09" note).

**Rules.** Names and times must be real and must match the public RaceResult protocol. No anonymous quotes, no marketing-written quotes. Include at least two women and one lower-table time in the sample set the design uses.

**Data and implementation notes.** This needs a small `testimonials` table or a JSON list: `name`, `quote`, `time`, `level`, `eventDate`, `videoId`, `photo`, `tags`, `locale`. Times and levels can be validated against `event_results` by runner id. Admin editing can come later; a JSON file in `src/content/` is enough for launch.

---

## Cross-section notes

- Reuse one live counter value across briefs 6 and 7 so the site never shows two different "places left".
- Every section ends within one scroll of a registration CTA; the page's two intended actions are "register solo" and "become a captain".
- All numbers that change (results count, women's results, slot counter, dates) come from the database. Hardcode only copy.
- Address appears once per section at most and is always the stadium, never the office.
