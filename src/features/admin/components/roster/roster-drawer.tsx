"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

import { markNoShow, revertToRegistered } from "@/features/admin/checkin-actions";
import { ConfirmSubmit } from "@/features/admin/components/confirm-submit";
import { adminButton } from "@/features/admin/components/shell/admin-button";
import { AdminEyebrow } from "@/features/admin/components/shell/admin-eyebrow";
import { AdminPill } from "@/features/admin/components/shell/admin-pill";
import { ParticipationBadge } from "@/features/admin/components/shell/participation-badge";
import type { ParticipationStatus } from "@/features/admin/events-data";
import { removeRegistration } from "@/features/admin/roster-actions";
import type { RosterRowView } from "@/features/admin/roster-view";

/**
 * One registration in full, as a slide-over beside the roster.
 *
 * The drawer is what pays for the compact table: contact and date of birth come
 * out of the columns and land here, together with the placement, the bib lease
 * and the actions on that runner. It renders from the row the page already read
 * — there is no fetch, and no server action of its own.
 *
 * Its only state lives one level up (which registration is open), so opening and
 * closing never touches the URL: the roster's `?q=` / `?status=` / `?sort=` /
 * `?page=` are exactly as they were when the drawer closes.
 *
 * Every form in here is one that already existed, with the hidden fields it
 * already took. Remove keeps its confirm dialog and its frozen redirect contract
 * (the status filter travels, nothing else), so it lands back on the roster with
 * the centralized flash. No-show and revert are the desk's two actions, gated the
 * way the desk gates them, and they do not redirect at all — the page
 * re-renders in place, so the drawer stays open with the new status on it. Each
 * is gated by the reader's admin level too, so a view-only admin gets the same
 * panel with no dead buttons under it.
 *
 * Body scroll is deliberately *not* locked. `ConfirmSubmit` — which opens from
 * inside this panel — owns `body.modal-open` and clears it when it closes, so a
 * lock taken here would be dropped by a cancelled confirmation. Below `sm` the
 * panel covers the viewport anyway.
 */
export function RosterDrawer({
  row,
  slug,
  locale,
  statusFilter,
  onClose,
  canEdit,
  canCheckin,
}: {
  row: RosterRowView;
  slug: string;
  locale: string;
  /** The roster's active status filter, which `removeRegistration` carries back. */
  statusFilter?: ParticipationStatus;
  onClose: () => void;
  /** `removeRegistration` asks for `edit`. */
  canEdit: boolean;
  /** No-show and undo are the desk's actions, gated at `checkin`. */
  canCheckin: boolean;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Focus lands in the panel rather than staying on the row behind the scrim, so
  // the keyboard is where the eye is and Escape has something to close.
  useEffect(() => {
    closeRef.current?.focus();
  }, [row.id]);

  return (
    <>
      {/* Above the sidebar rail (`z-50`), below `.iv-confirm-overlay` (`z-index:
          300`) — the confirmation this panel opens has to sit on top of it. */}
      <div aria-hidden onClick={onClose} className="fixed inset-0 z-50 bg-black/60" />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="roster-drawer-title"
        data-roster-drawer={row.id}
        className="fixed inset-y-0 right-0 z-[60] flex w-full flex-col border-l border-admin-line bg-admin-surface sm:w-[440px]"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-admin-line px-5 py-4">
          <div className="min-w-0">
            <AdminEyebrow>Registration</AdminEyebrow>
            <h2
              id="roster-drawer-title"
              className="mt-1.5 font-sans text-[19px] font-semibold normal-case not-italic leading-tight tracking-[-0.01em] text-admin-ink"
            >
              {row.name}
            </h2>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <ParticipationBadge status={row.status} />
              <BibLine row={row} />
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close detail"
            className="-mr-1 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-admin text-admin-muted transition-colors hover:bg-admin-surface-2 hover:text-admin-ink"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="admin-scroll min-h-0 flex-1 overflow-y-auto">
          <Section label="Contact">
            <Detail label="Email">{row.email}</Detail>
            <Detail label="Phone">{row.phone}</Detail>
          </Section>

          <Section label="Runner">
            <Detail label="Date of birth">{row.dateOfBirth}</Detail>
            <Detail label="Age cat.">{row.category}</Detail>
            <Detail label="Sex">{row.sex}</Detail>
            <Detail label="Club">{row.club}</Detail>
            <Detail label="Season best">{row.seasonBestDetail}</Detail>
          </Section>

          <Section label="Race">
            <Detail label="Heat">
              {row.heatLabel === null
                ? null
                : [row.heatLabel, row.heatTime, row.heatFinished ? "finished" : null]
                    .filter(Boolean)
                    .join(" · ")}
            </Detail>
            <Detail label="Bib">{bibDetail(row)}</Detail>
            <Detail label="Checked in">{row.checkedInAt}</Detail>
            <Detail label="Registered">{row.registeredAt}</Detail>
          </Section>
        </div>

        {/* A level that can do neither gets no footer at all, rather than an
            empty rule under the last fact. */}
        {canCheckin || canEdit ? (
          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-admin-line px-5 py-4">
            {canCheckin ? <StatusAction row={row} slug={slug} locale={locale} /> : <span />}

            {canEdit ? (
              <form action={removeRegistration}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="registrationId" value={row.id} />
                {statusFilter ? <input type="hidden" name="status" value={statusFilter} /> : null}
                <ConfirmSubmit
                  label="Remove"
                  title="Remove this registration?"
                  message={`This permanently deletes ${row.name}'s registration for this event. Use it for duplicates and withdrawal requests. This cannot be undone.`}
                  confirmLabel="Remove"
                  triggerClassName={adminButton(
                    "quiet",
                    "hover:bg-admin-accent-soft hover:text-admin-accent",
                  )}
                />
              </form>
            ) : null}
          </footer>
        ) : null}
      </aside>
    </>
  );
}

/**
 * The one action a runner's current status allows, worded as the desk words it.
 *
 * Neither action redirects, so neither raises a flash — the status badge above
 * changing is the feedback, in a panel that is still open on the runner it was
 * pressed for. That is the existing actions' own shape (they only
 * `revalidatePath`), and this slice adds no server action, so the roster inherits
 * it; it is the one place in the panel where feedback is not the flash banner.
 *
 * Gating follows `RunnerCard`'s for the case they share — a checked-in runner is
 * offered the undo, not "no-show" — and goes one step further for the case the
 * desk does not have: an already-absent runner is offered the undo too, because
 * re-marking a no-show as a no-show writes the same row again for no reason. Both
 * arms of `setRegistrationStatus` return the bib to the pool, so the undo is not
 * a way to keep a lease alive.
 */
function StatusAction({
  row,
  slug,
  locale,
}: {
  row: RosterRowView;
  slug: string;
  locale: string;
}) {
  const undo = row.status === "checked_in" || row.status === "no_show";

  return (
    <form action={undo ? revertToRegistered : markNoShow}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="registrationId" value={row.id} />
      <button type="submit" className={adminButton("stroke")}>
        {row.status === "checked_in"
          ? "Undo check-in"
          : row.status === "no_show"
            ? "Undo no-show"
            : "Mark no-show"}
      </button>
    </form>
  );
}

/**
 * The bib as a header pill beside the status badge — dimmed once the lease is
 * back in the pool, exactly as the table's bib column dims it.
 */
function BibLine({ row }: { row: RosterRowView }) {
  if (row.bib === null) return null;
  return (
    <AdminPill tone={row.holdsBib ? "ink" : "muted"}>bib {row.bib}</AdminPill>
  );
}

/** A bib is a lease (ADR 0003) — the drawer says which of the two it is showing. */
function bibDetail(row: RosterRowView): string | null {
  if (row.bib === null) return null;
  return row.holdsBib
    ? `${row.bib} · wearing it now`
    : `${row.bib} · returned to the pool`;
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="border-t border-admin-line px-5 py-4 first:border-t-0">
      <AdminEyebrow>{label}</AdminEyebrow>
      <dl className="mt-3 grid grid-cols-[minmax(0,88px)_minmax(0,1fr)] gap-x-4 gap-y-2.5">
        {children}
      </dl>
    </section>
  );
}

/**
 * One labelled value. An empty one still renders, as an em dash: "no phone
 * number on file" is a fact an admin looking at this panel needs, and a row that
 * silently disappears reads as a panel that forgot to say.
 */
function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="font-mono text-[10px] font-medium uppercase leading-[1.7] tracking-[0.14em] text-admin-muted">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-[13px] leading-[1.45] text-admin-ink-2">
        {children || "—"}
      </dd>
    </>
  );
}
