import type { EventResults } from "../types";

/** Build a time in hundredths of a second from minutes / seconds / hundredths. */
const cs = (m: number, s: number, c: number) => (m * 60 + s) * 100 + c;

/**
 * TEAMS MILE Warsaw — Stage 1 (first race weekend) results.
 *
 * Entered as officially recorded. Gender labels are kept as supplied
 * (bib 080 is recorded as "F" in the source results).
 */
export const warsaw2026Results: EventResults = {
  stage: "Stage 1",
  heats: [
    {
      number: 1,
      entries: [
        { place: 1, bib: 45, gender: "M", name: "Horbatko Dmytro", timeCs: cs(5, 12, 75) },
        { place: 2, bib: 35, gender: "M", name: "Suchodolski Aleksander", timeCs: cs(6, 19, 14) },
        { place: 3, bib: 21, gender: "F", name: "Ivanova Anastasia", timeCs: cs(6, 26, 27) },
        { place: 4, bib: 39, gender: "F", name: "Cisowska Lena", timeCs: cs(6, 38, 25) },
        { place: 5, bib: 27, gender: "M", name: "Ciepliński Patryk", timeCs: cs(7, 21, 35) },
        { place: 6, bib: 19, gender: "F", name: "Misztal Agnieszka", timeCs: cs(7, 34, 18) },
        { place: 7, bib: 23, gender: "F", name: "Ieltsova Nataliia", timeCs: cs(8, 28, 30) },
        { place: 8, bib: 33, gender: "F", name: "Rzepecka Inez", timeCs: cs(9, 27, 0) },
      ],
    },
    {
      number: 2,
      entries: [
        { place: 1, bib: 75, gender: "M", name: "Polaszek Antoni", timeCs: cs(5, 16, 24) },
        { place: 2, bib: 66, gender: "M", name: "Klim Łukasz", timeCs: cs(5, 24, 38) },
        { place: 3, bib: 83, gender: "M", name: "Jęcek Janusz", timeCs: cs(5, 35, 62) },
        { place: 4, bib: 60, gender: "M", name: "Kuźnicki Patryk", timeCs: cs(5, 59, 45) },
        { place: 5, bib: 80, gender: "F", name: "Uhera Grzegorz", timeCs: cs(6, 41, 72) },
        { place: 6, bib: 91, gender: "F", name: "Shokalo Marta", timeCs: cs(9, 15, 63) },
        { place: 7, bib: 65, gender: "F", name: "Szymkiwiak Milena", timeCs: cs(10, 52, 0) },
      ],
    },
  ],
};
