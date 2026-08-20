import { ConfirmSubmit } from "@/features/admin/components/confirm-submit";
import { adminButton } from "@/features/admin/components/shell/admin-button";
import { ADMIN_NOTE, ADMIN_TITLE, adminCard } from "@/features/admin/components/shell/admin-card";
import { AdminField, adminInput } from "@/features/admin/components/shell/admin-field";
import { AdminNotice } from "@/features/admin/components/shell/admin-notice";
import { deleteEvent } from "@/features/admin/event-actions";
import type { EventAttachedCounts } from "@/features/admin/events-data";
import { plural } from "@/features/admin/format";
import { cn } from "@/lib/utils";

/**
 * The hard delete, and its guard shown before it is reached for.
 *
 * Deleting an event deletes a row whose slug is the only thing five other tables
 * use to name it — there are no foreign keys — so it is allowed only while every
 * one of them is empty. The counts are read by the page and stated here, because
 * "why is this refused" has to be answerable without pressing anything, and
 * because the answer for a night people have entered is not "go and clear the
 * rows": it is cancelling, which keeps the record and tells the public.
 *
 * When it *is* allowed the press is still gated twice — the typed slug and then
 * {@link ConfirmSubmit} — since nothing about this is reversible.
 */

/** Rows keyed to the event's slug, in the order the guard reads them. */
/**
 * Re-exported rather than redeclared: the panel states the delete guard and
 * `deleteEvent` enforces it, so both must read the same shape from the same
 * query — see {@link countEventAttachedRows}.
 */
export type EventRowCounts = EventAttachedCounts;

/** Each non-zero count as the clause it becomes in the refusal sentence. */
function heldBy(counts: EventRowCounts): string[] {
  const parts: string[] = [];
  if (counts.registrations > 0) parts.push(plural(counts.registrations, "registration"));
  if (counts.results > 0) parts.push(plural(counts.results, "imported result"));
  if (counts.heats > 0) parts.push(plural(counts.heats, "heat"));
  if (counts.media > 0)
    parts.push(counts.media === 1 ? "a published gallery" : plural(counts.media, "gallery row"));
  if (counts.emails > 0) parts.push(plural(counts.emails, "logged email"));
  return parts;
}

export function EventDeletePanel({
  locale,
  slug,
  counts,
}: {
  locale: string;
  slug: string;
  counts: EventRowCounts;
}) {
  const held = heldBy(counts);

  return (
    <section
      className={adminCard("mt-4 p-4 sm:p-5")}
      data-event-delete={held.length === 0 ? "allowed" : "blocked"}
    >
      <h2 className={ADMIN_TITLE}>Delete this event</h2>

      {held.length > 0 ? (
        <>
          <p className={cn(ADMIN_NOTE, "mt-1.5 max-w-[78ch]")}>
            Not available — the event has {held.join(", ")} keyed to its slug, and the slug is the
            only thing tying them to it. Deleting the row would leave them behind pointing at
            nothing.
          </p>
          <AdminNotice className="mt-3">
            {counts.registrations > 0
              ? `${plural(counts.registrations, "person has", "people have")} entered — cancel it instead.`
              : "Cancel it instead."}{" "}
            Cancelling puts the cancelled notice on the public page and refuses registration, while
            the roster, heats and results stay on the record — and it is one press to undo. Delete
            is for a draft nobody ever touched.
          </AdminNotice>
          <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-[12.5px] sm:grid-cols-2">
            <Count label="event_registrations" value={counts.registrations} />
            <Count label="event_results" value={counts.results} />
            <Count label="event_heats" value={counts.heats} />
            <Count label="event_media" value={counts.media} />
            <Count label="event_email_log" value={counts.emails} />
          </dl>
        </>
      ) : (
        <>
          <p className={cn(ADMIN_NOTE, "mt-1.5 max-w-[78ch]")}>
            Nothing is keyed to this event — no registrations, results, heats, gallery or logged
            emails — so the row can go without stranding anything. It cannot be undone and there is
            no record of it afterwards: the slug becomes free again and a later event may generate
            it. Type the slug to confirm.
          </p>
          <form action={deleteEvent} className="mt-3 flex flex-wrap items-end gap-2.5">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="slug" value={slug} />
            <AdminField label="Type the slug" className="w-full max-w-[280px]">
              <input
                className={adminInput()}
                type="text"
                name="confirmSlug"
                required
                autoComplete="off"
                spellCheck={false}
                // Anchored by the browser, so a typo never reaches the action.
                // Escaped because a slug is data, not a regex — `-` is left
                // alone, since escaping it outside a character class is invalid
                // under the `v` flag this attribute is compiled with.
                pattern={slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}
                placeholder={slug}
                data-event-delete-confirm
              />
            </AdminField>
            <ConfirmSubmit
              label="Delete event"
              title="Delete this event for good?"
              message="The event row is removed and nothing about it is kept — it is not the same as cancelling, which keeps the night on the record. Only do this to a draft that was created by mistake."
              confirmLabel="Delete event"
              danger
              triggerClassName={adminButton("stroke", "border-admin-accent text-admin-accent")}
            />
          </form>
        </>
      )}
    </section>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-admin-line py-1">
      <dt className="font-mono text-[11px] text-admin-muted">{label}</dt>
      <dd
        className={cn("font-mono text-[12px]", value > 0 ? "text-admin-warn" : "text-admin-muted")}
      >
        {value}
      </dd>
    </div>
  );
}
