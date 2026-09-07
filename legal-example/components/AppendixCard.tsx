import Link from "next/link";
import type { InternalDocumentMeta } from "@/content/types";

/**
 * Kafelek dla dokumentów WYŁĄCZNIE do wglądu (Załączniki 1–5) — bez
 * odznaki "Wymagany/Opcjonalny" (to nie są dokumenty do podpisania),
 * tylko etykieta "Załącznik" i link do pełnej treści.
 */
export function AppendixCard({
  href,
  doc,
  label,
}: {
  href: string;
  doc: InternalDocumentMeta;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="card group flex flex-col justify-between p-5 transition-colors hover:border-brand-accent/50"
    >
      <div>
        <span className="eyebrow">{doc.kicker}</span>
        <h3 className="mt-3 font-display text-lg leading-tight">
          {doc.title}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm text-brand-textMuted">
          {doc.intro[0]}
        </p>
      </div>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold uppercase tracking-wide text-brand-accent transition-transform group-hover:translate-x-1">
        {label} →
      </span>
    </Link>
  );
}
