import type { EventResults } from "../types";

/** Build a time in hundredths of a second from minutes / seconds / hundredths. */
const cs = (m: number, s: number, c: number) => (m * 60 + s) * 100 + c;

/**
 * Individual Mile — 01.08.2026 race morning results.
 *
 * Entered as officially recorded in the timing system's export (names kept in
 * the source's surname-first casing). Finishers only — DNS/DNF entries carry
 * no time and have no place in this model.
 */
export const mile20260801Results: EventResults = {
  heats: [
    {
      number: 1,
      entries: [
        { place: 1, bib: 16, gender: "M", name: "TELKOVSKY Taras", timeCs: cs(4, 44, 83) },
        { place: 2, bib: 26, gender: "M", name: "POLASZEK Antoni", timeCs: cs(5, 13, 33) },
        { place: 3, bib: 25, gender: "M", name: "KOVKEL Vlad", timeCs: cs(5, 15, 30) },
        { place: 4, bib: 12, gender: "M", name: "JĘCEK Janusz", timeCs: cs(5, 34, 88) },
        { place: 5, bib: 22, gender: "M", name: "WOJCIECH Skup", timeCs: cs(5, 47, 2) },
        { place: 6, bib: 14, gender: "M", name: "NAIKO Vitalii", timeCs: cs(6, 39, 4) },
        { place: 7, bib: 18, gender: "M", name: "UHERA Grzegorz", timeCs: cs(6, 53, 29) },
        { place: 8, bib: 10, gender: "M", name: "BIKHUNOV Vitalii", timeCs: cs(7, 7, 38) },
        { place: 9, bib: 15, gender: "M", name: "PIDNEBESNYI Iurii", timeCs: cs(7, 7, 42) },
        { place: 10, bib: 28, gender: "M", name: "NESTERIUK Ivan", timeCs: cs(8, 45, 13) },
        { place: 11, bib: 30, gender: "M", name: "CHILAT Maxim", timeCs: cs(10, 32, 49) },
      ],
    },
    {
      number: 2,
      entries: [
        { place: 1, bib: 31, gender: "M", name: "KOVALENKO Alex", timeCs: cs(5, 55, 0) },
      ],
    },
  ],
};
