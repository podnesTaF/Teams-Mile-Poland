import type { Gender } from "./types";

/**
 * AB-mile rating levels (1 = top, 16 = entry).
 *
 * The time bars are the individual-participant "runner" standards published in
 * the prize table shown on the site — the men/women *runner* columns of
 * `PSTD_ROWS` in `components/landing/prize-fund-cta.tsx`. A result earns the
 * best (lowest-numbered) level whose bar it meets; anything slower than the
 * level-16 bar stays at the entry level 16.
 *
 * Kept here (not in the message catalogue) because the numbers are
 * locale-independent and need to be computed against, not just displayed.
 */

/** A mile time in hundredths of a second from whole minutes + seconds. */
const t = (m: number, s: number) => (m * 60 + s) * 100;

/** Slowest qualifying mile time per level, by gender, in hundredths of a second. */
const LEVEL_BARS: ReadonlyArray<{ level: number; m: number; f: number }> = [
  { level: 16, m: t(8, 0), f: t(9, 0) },
  { level: 15, m: t(7, 0), f: t(8, 20) },
  { level: 14, m: t(6, 20), f: t(7, 40) },
  { level: 13, m: t(5, 50), f: t(7, 0) },
  { level: 12, m: t(5, 30), f: t(6, 42) },
  { level: 11, m: t(5, 18), f: t(6, 30) },
  { level: 10, m: t(5, 9), f: t(6, 18) },
  { level: 9, m: t(5, 0), f: t(6, 6) },
  { level: 8, m: t(4, 51), f: t(5, 54) },
  { level: 7, m: t(4, 42), f: t(5, 42) },
  { level: 6, m: t(4, 34), f: t(5, 30) },
  { level: 5, m: t(4, 28), f: t(5, 18) },
  { level: 4, m: t(4, 22), f: t(5, 6) },
  { level: 3, m: t(4, 15), f: t(4, 54) },
  { level: 2, m: t(4, 9), f: t(4, 45) },
  { level: 1, m: t(4, 2), f: t(4, 38) },
];

/**
 * The AB-mile rating level for a net mile time: the fastest (lowest-numbered)
 * level whose time bar the result meets. Times slower than every bar floor at
 * the entry level 16.
 */
export function computeLevel(timeCs: number, gender: Gender): number {
  let level = 16;
  for (const bar of LEVEL_BARS) {
    const target = gender === "F" ? bar.f : bar.m;
    if (timeCs <= target && bar.level < level) level = bar.level;
  }
  return level;
}
