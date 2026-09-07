import Link from "next/link";
import type { DocumentContent } from "@/content/types";

const REQUIRED_BADGE_BY_SLUG: Record<string, boolean> = {
  oswiadczenie: true,
  regulamin: true,
  przepisy: true,
  rodo: true,
  lia: false,
};

export function DocumentCard({
  href,
  doc,
  cta,
  requiredLabel,
  optionalLabel,
}: {
  href: string;
  doc: DocumentContent;
  cta: string;
  requiredLabel: string;
  optionalLabel: string;
}) {
  const isRequired = REQUIRED_BADGE_BY_SLUG[doc.slug] ?? true;
  return (
    <Link
      href={href}
      className="card group flex flex-col justify-between p-6 transition-colors hover:border-brand-accent/50"
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow">{doc.kicker}</span>
          <span
            className={`rounded-pill px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
              isRequired
                ? "bg-brand-accentSoft text-brand-accent"
                : "bg-white/5 text-brand-textMuted"
            }`}
          >
            {isRequired ? requiredLabel : optionalLabel}
          </span>
        </div>
        <h3 className="mt-3 font-display text-xl leading-tight">
          {doc.title}
        </h3>
        <p className="mt-2 line-clamp-3 text-sm text-brand-textMuted">
          {doc.intro[0]}
        </p>
      </div>
      <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold uppercase tracking-wide text-brand-accent transition-transform group-hover:translate-x-1">
        {cta}
      </span>
    </Link>
  );
}
