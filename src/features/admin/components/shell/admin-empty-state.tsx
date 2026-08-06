import type { ReactNode } from "react";

/**
 * The admin layer's designed empty state: a dashed panel that says what is
 * missing and where the next action lives, instead of a bare card or a stray
 * sentence.
 *
 * Deliberately headline + prose only. An empty screen's next step is usually a
 * link the calling page already has in its topbar, or — as on the events index —
 * a config change no button can perform.
 */
export function AdminEmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-admin-lg border border-dashed border-admin-line-2 bg-admin-surface px-6 py-14 text-center">
      <h2 className="font-sans text-[15px] font-semibold normal-case not-italic leading-tight text-admin-ink">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-[52ch] text-[13px] leading-relaxed text-admin-muted">
        {children}
      </p>
    </div>
  );
}
