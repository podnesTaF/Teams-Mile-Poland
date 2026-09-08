"use client";

import { Printer } from "lucide-react";

import { adminButton } from "@/features/admin/components/shell/admin-button";
import { ADMIN_NOTE } from "@/features/admin/components/shell/admin-card";
import { plural } from "@/features/admin/format";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * The batch-print control shared by the two surfaces that can select
 * registrations: the event roster and the Statements list (#55).
 *
 * It owns no selection of its own — the table above it does, because the ticks
 * live in the table's rows — so this is a presentational strip: it says how many
 * registrations are ticked, points at the print route with those ids, and
 * clears them. Both surfaces render the same strip so "Print selected" means the
 * same thing wherever an admin finds it.
 *
 * **What "selected" counts.** The roster is paged, and ticks accumulate across
 * pages: a night is printed by walking the list, not by one screenful. So the
 * count here is the whole selection, and the strip says out loud how much of it
 * is off-screen — an admin must never press print on a number they cannot
 * account for. What it is *not* is a selection the admin never made: the
 * select-all box in the table header covers the rows in view and nothing else,
 * and no filter, sort or page change ever adds an id.
 *
 * This is deliberately **not** the rule the bulk heat move follows one strip
 * above it (#41 posts only the ticks on the page in view, and says so). The two
 * differ because the acts differ: a heat move writes to the rows it names and
 * was scoped to what the admin can see for that reason, while printing reads,
 * and a batch that silently dropped page 1 would produce a stack of paper that
 * is quietly missing runners. Both counts are labelled with their scope so the
 * two numbers side by side are readable rather than contradictory.
 *
 * `data-statements-*` markers are stable hooks for end-to-end checks.
 */

/**
 * The print route reads at most this many ids (`IDS_LIMIT` on the print page).
 * Mirrored here so the strip can say a selection is over the cap *before* it is
 * pressed, rather than silently printing a prefix of it.
 */
export const PRINT_IDS_LIMIT = 200;

export function StatementPrintBar({
  slug,
  ids,
  onPage,
  onClear,
  className,
}: {
  slug: string;
  /** Every ticked registration id, in the order they were ticked. */
  ids: string[];
  /** How many of those are among the rows currently in view. */
  onPage: number;
  onClear: () => void;
  className?: string;
}) {
  const total = ids.length;
  const none = total === 0;
  const capped = total > PRINT_IDS_LIMIT;
  const printing = capped ? ids.slice(0, PRINT_IDS_LIMIT) : ids;
  const elsewhere = total - onPage;

  const href = `/admin/events/${slug}/statements/print?ids=${printing.join(",")}`;

  return (
    <div
      data-statements-print-bar=""
      className={cn(
        "flex flex-wrap items-center gap-x-2.5 gap-y-3 border-b border-admin-line p-4",
        className,
      )}
    >
      {/* A `span` rather than a dimmed link when there is nothing to print, so
          there is nothing to click and nothing for the keyboard to land on —
          the pager's idiom. The hint beside it says why. */}
      {none ? (
        <span
          aria-disabled
          data-statements-print-action="disabled"
          className={adminButton("primary", "cursor-default opacity-45")}
        >
          <Printer className="h-3.5 w-3.5" aria-hidden />
          Print selected
        </span>
      ) : (
        <Link
          href={href}
          // A new tab: the print view is a dead end you close, and losing the
          // roster's selection to reach it would defeat the point of collecting
          // it across pages.
          target="_blank"
          rel="noopener"
          data-statements-print-action="ready"
          className={adminButton("primary")}
        >
          <Printer className="h-3.5 w-3.5" aria-hidden />
          Print {total} selected
        </Link>
      )}

      <button type="button" className={adminButton("quiet")} onClick={onClear} disabled={none}>
        Clear selection
      </button>

      <p
        data-statements-selected={total}
        data-statements-selected-on-page={onPage}
        className={cn(
          "ml-auto self-center font-mono text-[10px] font-medium uppercase tracking-[0.16em]",
          none ? "text-admin-muted" : "text-admin-ink",
        )}
      >
        {total} selected for print
      </p>

      <p data-statements-print-note className={cn(ADMIN_NOTE, "w-full")}>
        {none
          ? "Nothing is selected, so there is nothing to print. Tick the runners whose statements you need — the box in the header ticks the rows on this page — and they collect here as you page through the roster."
          : capped
            ? `${total} are selected and the print view takes ${PRINT_IDS_LIMIT} at a time, so this prints the first ${PRINT_IDS_LIMIT}. Print those, clear the selection, and take the rest in a second pass.`
            : `${plural(total, "statement")} print in one pass, each on its own sheet, each in the language its runner accepted in — the print view can force one language for the whole batch. ${
                elsewhere > 0
                  ? `${elsewhere} of them ${elsewhere === 1 ? "is" : "are"} on another page of this roster and ${elsewhere === 1 ? "is" : "are"} included.`
                  : "Everything selected is on this page."
              } A runner with no consent on record prints as that fact, not as a reconstructed document.`}
      </p>
    </div>
  );
}
