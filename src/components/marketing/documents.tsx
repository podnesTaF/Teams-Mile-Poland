import { DOCUMENTS, type DocLocale } from "@/lib/marketing/event";
import { cn } from "@/lib/utils";

const FALLBACK_NOTE = {
  en: "Polish only",
  pl: "Tylko po polsku",
} as const;

const ACTION_LABEL = {
  en: "Download",
  pl: "Pobierz",
} as const;

const SOON_LABEL = {
  en: "Soon",
  pl: "Wkrótce",
} as const;

type DocumentsProps = {
  locale?: DocLocale;
};

export function Documents({ locale = "en" }: DocumentsProps) {
  return (
    <div className="grid grid-cols-1 border border-ink md:grid-cols-2 xl:grid-cols-3">
      {DOCUMENTS.map((doc) => {
        const file = doc.files[locale] ?? doc.files.pl ?? doc.files.en;
        const fileLocale: DocLocale | null = doc.files[locale]
          ? locale
          : doc.files.pl
            ? "pl"
            : doc.files.en
              ? "en"
              : null;
        const isFallback = fileLocale !== null && fileLocale !== locale;
        const isPending = !file;
        const isPrimary = Boolean(doc.primary);

        const baseClass = cn(
          "group flex min-h-[280px] flex-col gap-[18px] border-b border-r border-ink p-6 transition-colors duration-150 last:border-b-0 md:[&:nth-of-type(2n)]:border-r-0 xl:[&:nth-of-type(2n)]:border-r xl:[&:last-child]:border-r-0 xl:border-b-0",
          isPrimary && "bg-accent text-white",
          !isPrimary &&
            !isPending &&
            "bg-bg text-ink hover:bg-ink hover:text-white",
          isPending && "cursor-not-allowed bg-bg text-ink",
        );

        const Wrapper = ({ children }: { children: React.ReactNode }) =>
          isPending || !file ? (
            <div
              role="link"
              aria-disabled
              tabIndex={-1}
              className={baseClass}
            >
              {children}
            </div>
          ) : (
            <a
              href={file.href}
              target="_blank"
              rel="noopener"
              className={baseClass}
            >
              {children}
            </a>
          );

        return (
          <Wrapper key={doc.id}>
            <div className="flex items-start justify-between gap-3">
              <span
                className={cn(
                  "border bg-bg-2 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em]",
                  isPrimary
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-line text-muted group-hover:border-white/20 group-hover:bg-white/10 group-hover:text-white",
                )}
              >
                {doc.tag[locale]}
              </span>
              <span
                aria-hidden
                className={cn(
                  "relative flex h-14 w-11 flex-shrink-0 items-end justify-center border bg-bg-2 pb-1.5 font-display-alt text-[9px] font-semibold uppercase tracking-[0.12em]",
                  isPrimary
                    ? "border-ink bg-ink text-white"
                    : "border-line-2 text-ink group-hover:border-accent group-hover:bg-accent group-hover:text-white",
                  isPending && "opacity-40",
                )}
              >
                <span className="absolute -right-px -top-px h-3 w-3 [background:linear-gradient(135deg,transparent_50%,var(--color-ink)_50%)]" />
                PDF
              </span>
            </div>

            <div>
              <h4 className="mb-3 font-display text-[clamp(18px,1.8vw,22px)] font-black italic uppercase leading-none tracking-tight">
                {doc.title[locale]}
              </h4>
              <p
                className={cn(
                  "m-0 max-w-[32ch] text-[13px] leading-relaxed",
                  isPrimary ? "text-white/85" : "text-muted",
                  !isPrimary && !isPending && "group-hover:text-white/70",
                )}
              >
                {doc.desc[locale]}
              </p>
            </div>

            <div className="mt-auto flex items-center justify-between gap-3 border-t border-current/20 pt-3.5 text-xs">
              <span
                className={cn(
                  "font-mono text-[10px] uppercase tracking-[0.1em]",
                  isPrimary ? "text-white/70" : "text-muted",
                )}
              >
                {isPending
                  ? "PDF · soon"
                  : `${file.meta}${isFallback ? ` · ${FALLBACK_NOTE[locale]}` : ""}`}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 font-display-alt text-xs font-medium uppercase tracking-[0.08em]",
                  isPending && "text-muted",
                )}
              >
                {isPending ? SOON_LABEL[locale] : ACTION_LABEL[locale]}
                <span aria-hidden>{isPending ? "" : "↓"}</span>
              </span>
            </div>
          </Wrapper>
        );
      })}
    </div>
  );
}
