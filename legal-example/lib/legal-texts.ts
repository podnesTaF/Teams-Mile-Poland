import fs from "node:fs";
import path from "node:path";
import type { AnyDocSlug, Locale } from "./types";

const ROOT = path.join(process.cwd(), "content", "legal-texts");
const TEAM_ROOT = path.join(process.cwd(), "content", "legal-texts-team");

/**
 * Dokumenty formatu "team" (drużynowo-indywidualnego TEAM MILE POLAND) są
 * trzymane w osobnym folderze (content/legal-texts-team) pod krótszymi
 * nazwami plików (bez powtarzania prefiksu "team-"), więc slug widoczny
 * w aplikacji (np. "team-regulations") mapujemy tutaj na rzeczywistą
 * nazwę pliku ("regulations.html").
 */
function resolvePath(locale: Locale, doc: AnyDocSlug): string {
  if (doc.startsWith("team-")) {
    const fileName = doc.slice("team-".length);
    return path.join(TEAM_ROOT, locale, `${fileName}.html`);
  }
  return path.join(ROOT, locale, `${doc}.html`);
}

function resolveFallbackPath(doc: AnyDocSlug): string {
  if (doc.startsWith("team-")) {
    const fileName = doc.slice("team-".length);
    return path.join(TEAM_ROOT, "pl", `${fileName}.html`);
  }
  return path.join(ROOT, "pl", `${doc}.html`);
}

/**
 * Zwraca gotowy fragment HTML pełnej treści dokumentu prawnego
 * (wygenerowany raz, offline, z zatwierdzonych plików .docx — patrz
 * content/legal-texts/README.md po szczegóły procesu regeneracji).
 *
 * WYŁĄCZNIE do użytku w Server Components (korzysta z node:fs) — nigdy
 * nie importuj tego pliku w komponencie z "use client".
 *
 * Fallback: jeśli tłumaczenie na dany język nie istnieje, zwracamy
 * polską wersję i `usedFallback: true`, żeby UI mogło o tym uprzedzić.
 */
export function getLegalHtml(
  locale: Locale,
  doc: AnyDocSlug,
): { html: string; usedFallback: boolean } {
  const primary = resolvePath(locale, doc);
  if (fs.existsSync(primary)) {
    return { html: fs.readFileSync(primary, "utf-8"), usedFallback: false };
  }

  const fallback = resolveFallbackPath(doc);
  if (fs.existsSync(fallback)) {
    return { html: fs.readFileSync(fallback, "utf-8"), usedFallback: true };
  }

  return { html: "", usedFallback: false };
}

export function hasNativeLegalHtml(locale: Locale, doc: AnyDocSlug): boolean {
  return fs.existsSync(resolvePath(locale, doc));
}
