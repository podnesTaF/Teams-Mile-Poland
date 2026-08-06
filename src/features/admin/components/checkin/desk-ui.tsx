import type { ReactNode } from "react";

import {
  adminButton,
  type AdminButtonVariant,
} from "@/features/admin/components/shell/admin-button";
import { adminCard, ADMIN_TITLE } from "@/features/admin/components/shell/admin-card";
import { adminInput } from "@/features/admin/components/shell/admin-field";
import { AdminPill } from "@/features/admin/components/shell/admin-pill";
import { cn } from "@/lib/utils";

/**
 * The check-in desk's own sizing of the admin layer.
 *
 * Every other admin surface is used sitting down with a mouse; this one is used
 * standing at the venue on race morning, holding a phone in one hand and pressing
 * with the thumb of the other. So the desk keeps the panel, the type and the
 * colour language of the rest of the panel and changes only the one thing that
 * matters there: controls are 48px tall rather than 36px, which is the smallest
 * comfortable touch target, and inputs are set at 16px because anything smaller
 * makes iOS Safari zoom the page on focus — mid-scan, that is a lost runner.
 */

/**
 * Height of a desk control. Shared so a button and an input line up in a row.
 *
 * `leading-none` is restated alongside every size below, not inherited: an
 * arbitrary `text-[…]` can carry a line-height in Tailwind, so `tailwind-merge`
 * treats it as overriding the `leading-*` the base class string set — silently
 * giving the control a 1.5 line box. Re-state it *after* the size.
 */
const DESK_CONTROL = "h-12";

/** A control-sized press for the desk — {@link adminButton}, thumb-sized. */
export function deskButton(variant: AdminButtonVariant = "stroke", className?: string): string {
  return adminButton(variant, cn(DESK_CONTROL, "gap-2 px-4 text-[14.5px] leading-none", className));
}

/** A control-sized field for the desk — {@link adminInput}, thumb-sized. */
export function deskInput(className?: string): string {
  return adminInput(cn(DESK_CONTROL, "px-3 text-[16px] leading-none", className));
}

/**
 * A desk press that posts one of the race-morning actions.
 *
 * The hidden fields are the whole point: every action on this surface is rebuilt
 * server-side from `locale` + `slug` (+ the runner or the heat it acts on), and
 * `q` rides along so the redirect lands back on the same search results. They
 * travel together everywhere, so they are written once here rather than
 * re-typed per form — which is also what stops one form quietly losing `q` and
 * bouncing the desk back to an empty search mid-scan.
 *
 * `q` is passed even when empty, exactly as before: `resolveSurface` reads it as
 * `""` either way.
 */
export function DeskActionForm({
  action,
  locale,
  slug,
  q,
  registrationId,
  heatId,
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  locale: string;
  slug: string;
  q?: string;
  registrationId?: string;
  heatId?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <form action={action} className={className}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="slug" value={slug} />
      {registrationId === undefined ? null : (
        <input type="hidden" name="registrationId" value={registrationId} />
      )}
      {heatId === undefined ? null : <input type="hidden" name="heatId" value={heatId} />}
      {q === undefined ? null : <input type="hidden" name="q" value={q} />}
      {children}
    </form>
  );
}

/**
 * One of the desk's standing sections — the two working lists and the heat desk.
 *
 * The count sits beside the heading rather than inside the body because it is the
 * thing being watched ("is anyone still waiting?"), and `meta` is the sentence
 * that explains it. `actions` is the section's own control, if it has one.
 */
export function DeskPanel({
  id,
  title,
  count,
  countTone,
  meta,
  actions,
  children,
}: {
  id?: string;
  title: string;
  count?: number;
  countTone?: "muted" | "warn" | "ok";
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className={adminCard("p-4 sm:p-5")}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <h2 className={ADMIN_TITLE}>{title}</h2>
          {count === undefined ? null : <AdminPill tone={countTone}>{count}</AdminPill>}
        </div>
        {actions ?? (meta ? <p className="text-[12.5px] text-admin-muted">{meta}</p> : null)}
      </div>
      {actions && meta ? <p className="mt-1 text-[12.5px] text-admin-muted">{meta}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * A row in one of the desk's lists: who, what is known about them, and the one
 * press that belongs to them. Single column on a phone, one line from `sm` up.
 */
export function DeskRow({
  name,
  sub,
  facts,
  action,
}: {
  name: string;
  sub?: ReactNode;
  /** Short labelled values — heat, arrival time, bib. */
  facts?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 rounded-admin border border-admin-line bg-admin-surface-2 p-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="truncate font-sans text-[14.5px] font-medium normal-case not-italic leading-tight text-admin-ink">
          {name}
        </p>
        {sub ? <p className="mt-1 truncate text-[12.5px] text-admin-muted">{sub}</p> : null}
      </div>
      {facts ? <div className="flex flex-wrap items-center gap-x-4 gap-y-1">{facts}</div> : null}
      {action}
    </li>
  );
}

/** A labelled value inside a {@link DeskRow} — the columns a table would have had. */
export function DeskFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[9.5px] font-medium uppercase tracking-[0.16em] text-admin-muted">
        {label}
      </p>
      <p className="mt-0.5 truncate text-[13px] text-admin-ink-2">{children}</p>
    </div>
  );
}
