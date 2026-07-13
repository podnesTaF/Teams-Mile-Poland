import Markdown from "react-markdown";

/**
 * Renders an article's markdown body on the server. `react-markdown` does not
 * pass raw HTML through by default (no `rehype-raw`), so author-supplied markup
 * is inert — only headings, links, lists, emphasis, code, and images render.
 * Links open in a new tab with `rel="noopener"` since article copy routinely
 * points off-site (e.g. to registration).
 */
export function ArticleBody({ markdown }: { markdown: string }) {
  return (
    <Markdown
      components={{
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
      }}
    >
      {markdown}
    </Markdown>
  );
}
