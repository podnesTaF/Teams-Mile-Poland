import type { NewsArticle } from "@/db/schema";

/** The trilingual columns a public surface reads off an article. */
type Trilingual = Pick<
  NewsArticle,
  "titlePl" | "titleEn" | "titleUa" | "bodyPl" | "bodyEn" | "bodyUa"
>;

/**
 * The article title in `locale`. All three locales are required at publish time
 * (enforced in `publishArticle`), so a published article always has a non-empty
 * value here and no fallback logic is needed.
 */
export function titleFor(article: Trilingual, locale: string): string {
  if (locale === "en") return article.titleEn;
  if (locale === "ua") return article.titleUa;
  return article.titlePl;
}

/** The markdown body in `locale`. See {@link titleFor} on the no-fallback rule. */
export function bodyFor(article: Trilingual, locale: string): string {
  if (locale === "en") return article.bodyEn;
  if (locale === "ua") return article.bodyUa;
  return article.bodyPl;
}

/**
 * A plain-text excerpt derived from the opening of a markdown body — the PRD
 * keeps no stored excerpt field, so list cards derive one on the fly. Strips the
 * common markdown constructs to readable prose, collapses whitespace, and
 * truncates on a word boundary with an ellipsis.
 */
export function deriveExcerpt(markdown: string, maxLen = 180): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ") // fenced code blocks
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → link text
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // ATX headings
    .replace(/^\s{0,3}>\s?/gm, "") // blockquotes
    .replace(/^\s{0,3}[-*+]\s+/gm, "") // unordered list markers
    .replace(/^\s{0,3}\d+\.\s+/gm, "") // ordered list markers
    .replace(/[*_~]+/g, "") // emphasis / strikethrough marks
    .replace(/\s+/g, " ")
    .trim();

  if (plain.length <= maxLen) return plain;
  const cut = plain.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
