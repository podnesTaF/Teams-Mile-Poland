/**
 * Normalize a person name for matching: lowercase, diacritics stripped —
 * including letters with no NFD decomposition (ł, đ, ø, …) — non-letters
 * collapsed to spaces, tokens sorted so "Klim Łukasz" and "Lukasz Klim"
 * collide.
 *
 * Results are hand-entered surname-first with inconsistent casing, while
 * profiles carry firstName/lastName — the token sort is what lets the two
 * meet. Extracted from `scripts/import-first-event.ts`, where the collision
 * behaviour was validated against the full warsaw-2026 field.
 */
const NON_DECOMPOSING: Record<string, string> = { ł: "l", đ: "d", ð: "d", ø: "o", æ: "ae", ß: "ss" };

export function nameKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[łđðøæß]/g, (c) => NON_DECOMPOSING[c] ?? c)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .sort()
    .join(" ");
}
