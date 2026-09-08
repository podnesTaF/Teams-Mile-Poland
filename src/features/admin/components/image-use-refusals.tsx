import { ADMIN_NOTE, ADMIN_TITLE, adminCard } from "@/features/admin/components/shell/admin-card";
import { getImageUseRefusals } from "@/features/event-registration/data";
import { userCan, type SessionUser } from "@/lib/auth/user-session";
import { cn } from "@/lib/utils";

/**
 * Adjacent to the gallery publish action (PRD #50 user story 24 / issue #56):
 * who registered for this event has refused image use, so whoever clicks
 * Publish sees it first. `event_media` publishes a whole Drive folder with no
 * per-runner exclusion — this is an operational promise, not a technical gate
 * (see the PRD's "Image refusal is an operational promise" decision).
 * Publishing itself is unchanged and is **not** blocked by this list.
 *
 * Names tied to a consent choice are personal data (ADR 0007): a role without
 * `personal_data` sees neither the list nor its count, only a short withheld
 * note. The media page itself stays visible to every admin level — this
 * section is the part that is withheld, not the page.
 */
export async function ImageUseRefusals({ slug, actor }: { slug: string; actor: SessionUser }) {
  if (!userCan(actor, "personal_data")) {
    return (
      <p className={cn(ADMIN_NOTE, "mt-4")} data-image-refusals-withheld>
        Image-use refusals are withheld on this role — full admin access is required to view them.
      </p>
    );
  }

  const refusals = await getImageUseRefusals(slug);

  return (
    <section className={adminCard("mt-4 p-4 sm:p-5")} data-image-refusals>
      <h2 className={ADMIN_TITLE}>Image-use refusals ({refusals.length})</h2>
      <p className={cn(ADMIN_NOTE, "mt-1.5 max-w-[78ch]")}>
        Check the gallery against this list before publishing — publishing does not do it for you.
        The Drive folder is shared whole, so pulling a photo of someone here is a manual step.
      </p>

      {refusals.length === 0 ? (
        <p className={cn(ADMIN_NOTE, "mt-3")} data-image-refusals-empty>
          Nobody registered for this event has refused image use.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-admin-line text-[13px] text-admin-ink" data-image-refusals-list>
          {refusals.map((r) => (
            <li key={r.registrationId} className="flex items-center justify-between gap-3 py-1.5">
              <span>{r.name}</span>
              <span className="font-mono text-[12px] text-admin-ink-2">
                {r.bib != null ? `Bib ${r.bib}` : "No bib"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
