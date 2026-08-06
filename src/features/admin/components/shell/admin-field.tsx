import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Form controls in the Tailwind admin layer — the `.iv-input` / `.iv-fieldlabel`
 * pair, rebuilt for the redesigned pages (ADR 0004).
 *
 * The old control is 52px tall poster-form furniture; an admin tool packs four
 * fields and a button into one row, so these are control-sized and share the
 * 36px height of {@link adminButton} to line up beside it.
 */

/**
 * Classes for a text / number / datetime-local input or a `<select>`.
 *
 * `admin-control` is not decoration: it carries the `color-scheme: dark` and
 * dark `option` rules from `admin.css` that a background colour alone cannot
 * give a native date picker or select popup.
 */
export function adminInput(className?: string): string {
  return cn(
    "admin-control h-9 w-full rounded-admin border border-admin-line-2 bg-admin-surface-2 px-2.5",
    "font-sans text-[13px] font-normal normal-case not-italic leading-none text-admin-ink",
    "outline-none transition-colors placeholder:text-admin-muted focus:border-admin-accent",
    "disabled:cursor-not-allowed disabled:opacity-50",
    className,
  );
}

/**
 * A labelled control. `className` sizes the field, since an admin form row is
 * mostly narrow numbers next to one wide select.
 *
 * The label is a `<span>`, not {@link AdminEyebrow}: that renders a `<p>`, and a
 * `<label>` takes phrasing content only.
 */
export function AdminField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-1.5 block truncate font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-admin-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
