/**
 * Transliteration-light kebab-case slug from a title. Strips diacritics via
 * Unicode decomposition (so "Otwarcie" stays clean and "ą/é/ü" fold to a/e/u),
 * maps the Polish letters NFD can't decompose (ł), lowercases, and collapses
 * every other run of non-alphanumerics into single hyphens.
 *
 * Shared by the admin form's EN-title auto-suggest (client) and the server
 * actions' fallback when the submitted slug is blank, so both derive the same
 * value from the same title.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
