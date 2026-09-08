"use client";

import { useMemo, useState } from "react";

import { StatementPrintBar } from "@/features/admin/components/statement-print-bar";
import { Link } from "@/i18n/navigation";
import type { DocLocale } from "@/lib/legal/manifest";
import { cn } from "@/lib/utils";

/**
 * The Statements list, with the same selection the roster has (#55).
 *
 * A client island for one reason only: which rows are ticked. Everything it
 * renders is read and formatted by the page above it and arrives as plain
 * strings, so `statements.ts` — Drizzle, `node:fs`, the legal corpus — stays out
 * of the browser bundle, and no runner's personal data crosses into it either:
 * the columns here are a name, an e-mail, a bib and the fact that consent was
 * recorded. The document itself is only ever assembled server-side, behind the
 * print route's own `personal_data` gate.
 *
 * Both surfaces that can print a batch carry the identical strip
 * ({@link StatementPrintBar}) and the identical select-all rule — the box in the
 * header ticks the rows in view — so "Print selected" behaves the same wherever
 * an admin reaches it. The difference is only that this list is not paged: it is
 * a race night's worth of entries read down in one go, so "the rows in view" is
 * the whole list and the strip's count and its on-page count always agree.
 *
 * The per-row links from #54 are untouched: one runner, in the language they
 * accepted or in either translation, is still one click, and is still the right
 * way to answer a question about a single entry.
 */

/** One line of the list, already formatted for display. */
export type StatementListRow = {
  registrationId: string;
  name: string;
  email: string;
  /** Already "—" when the runner holds no bib. */
  bib: string;
  /** Warsaw-local acceptance stamp, or `null` when nothing was ever recorded. */
  acceptedAtLabel: string | null;
  /** The language the runner read — the operative text. `null` with no record. */
  recordedLocale: DocLocale | null;
};

const HEAD_CELL =
  "px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-admin-muted";
const CELL = "px-3 py-2 align-middle text-[13px] text-admin-ink-2";

/** The three languages a Statement can be printed in, in publication order. */
const PRINT_LOCALES: readonly DocLocale[] = ["pl", "en", "ua"];

const LOCALE_LABEL: Record<DocLocale, string> = { pl: "PL", en: "EN", ua: "UA" };

export function StatementsTable({ slug, rows }: { slug: string; rows: StatementListRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  /**
   * Derived through `rows` rather than read off the `Set` directly, so a count
   * can never name a row that is not on screen. Nothing here is paged, so this
   * is the whole selection — the shape is kept because it is the roster's, and
   * the two surfaces should not drift.
   */
  const selectedIds = useMemo(
    () => rows.filter((row) => selected.has(row.registrationId)).map((row) => row.registrationId),
    [rows, selected],
  );

  const allShown = rows.length > 0 && selectedIds.length === rows.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Tick every row in view, or clear them if they are all already ticked. */
  function toggleShown() {
    setSelected((prev) => {
      const next = new Set(prev);
      const on = rows.length > 0 && rows.every((row) => next.has(row.registrationId));
      for (const row of rows) {
        if (on) next.delete(row.registrationId);
        else next.add(row.registrationId);
      }
      return next;
    });
  }

  return (
    <>
      <StatementPrintBar
        slug={slug}
        ids={selectedIds}
        onPage={selectedIds.length}
        onClear={() => setSelected(new Set())}
      />

      <div className="admin-scroll overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="border-b border-admin-line text-left">
              <th scope="col" className={cn(HEAD_CELL, "w-[44px] pr-0")}>
                <input
                  type="checkbox"
                  checked={allShown}
                  onChange={toggleShown}
                  ref={(el) => {
                    if (el) el.indeterminate = selectedIds.length > 0 && !allShown;
                  }}
                  aria-label={allShown ? "Clear this page" : "Select this page"}
                  data-statements-select-page={
                    allShown ? "all" : selectedIds.length > 0 ? "some" : "none"
                  }
                  className="h-3.5 w-3.5 accent-admin-accent"
                />
              </th>
              <th className={HEAD_CELL}>Runner</th>
              <th className={HEAD_CELL}>Bib</th>
              <th className={HEAD_CELL}>Consent</th>
              <th className={HEAD_CELL}>Statement</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <StatementRow
                key={row.registrationId}
                slug={slug}
                row={row}
                ticked={selected.has(row.registrationId)}
                onToggle={toggle}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** One registration: who it is, what was recorded, and the way into the print view. */
function StatementRow({
  slug,
  row,
  ticked,
  onToggle,
}: {
  slug: string;
  row: StatementListRow;
  ticked: boolean;
  onToggle: (id: string) => void;
}) {
  const base = `/admin/events/${slug}/statements/print?ids=${encodeURIComponent(row.registrationId)}`;

  return (
    <tr
      className={cn(
        "border-b border-admin-line last:border-0",
        ticked && "bg-admin-accent-soft",
      )}
      data-statement-row={row.registrationId}
      data-consent={row.recordedLocale ? "recorded" : "none"}
      data-selected={ticked ? "true" : "false"}
    >
      <td className={cn(CELL, "pr-0")}>
        {/* A runner with nothing on record is selectable on purpose: printing a
            night's batch should account for every entry asked for, and their
            sheet states the absence rather than omitting them (user story 26). */}
        <input
          type="checkbox"
          checked={ticked}
          onChange={() => onToggle(row.registrationId)}
          aria-label={`Select ${row.name}`}
          className="h-3.5 w-3.5 accent-admin-accent"
        />
      </td>
      <td className={CELL}>
        <span className="block text-admin-ink">{row.name}</span>
        <span className="block text-[12px] text-admin-muted">{row.email}</span>
      </td>
      <td className={cn(CELL, "font-mono")}>{row.bib}</td>
      <td className={CELL}>
        {row.recordedLocale ? (
          <>
            <span className="block">{row.acceptedAtLabel}</span>
            <span className="block text-[12px] text-admin-muted">
              Read in {LOCALE_LABEL[row.recordedLocale]} · Europe/Warsaw
            </span>
          </>
        ) : (
          <span
            className="inline-flex items-center rounded-pill border border-admin-line-2 px-2 py-0.5 text-[11px] uppercase tracking-[0.08em] text-admin-muted"
            data-statement-state="no-consent"
          >
            No consent on record
          </span>
        )}
      </td>
      <td className={CELL}>
        {row.recordedLocale ? (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link
              href={base}
              className="text-admin-ink underline decoration-admin-line-2 underline-offset-2 hover:decoration-admin-accent"
              data-statement-view={row.registrationId}
            >
              View statement
            </Link>
            <span className="flex items-center gap-1.5 text-[11px] text-admin-muted">
              {PRINT_LOCALES.map((lang) => (
                <Link
                  key={lang}
                  href={`${base}&lang=${lang}`}
                  aria-label={`View this statement in ${LOCALE_LABEL[lang]}`}
                  className={cn(
                    "rounded-admin px-1.5 py-0.5 hover:bg-admin-surface-2 hover:text-admin-ink",
                    // The recorded language is not a preference among three —
                    // it is the text that was accepted, so it reads as the
                    // default and the other two as translations.
                    lang === row.recordedLocale && "text-admin-ink",
                  )}
                >
                  {LOCALE_LABEL[lang]}
                </Link>
              ))}
            </span>
          </span>
        ) : (
          <span className="text-[12px] text-admin-muted">
            Registered before consent was captured — nothing to print.
          </span>
        )}
      </td>
    </tr>
  );
}
