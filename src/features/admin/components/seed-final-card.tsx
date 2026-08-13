import { ConfirmSubmit } from "@/features/admin/components/confirm-submit";
import { adminButton } from "@/features/admin/components/shell/admin-button";
import { ADMIN_NOTE, ADMIN_TITLE, adminCard } from "@/features/admin/components/shell/admin-card";
import { AdminField, adminInput } from "@/features/admin/components/shell/admin-field";
import { AdminPill } from "@/features/admin/components/shell/admin-pill";
import { plural } from "@/features/admin/format";
import { seedFinalFromResults } from "@/features/admin/heat-actions";
import type { HeatWithFill } from "@/features/admin/heats-data";
import type { Qualifier } from "@/features/admin/results-import/data";
import { formatHeatTime } from "@/lib/events/heat-time";
import { formatTime } from "@/lib/events/time";
import { cn } from "@/lib/utils";

const HEAD_CELL =
  "px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-admin-muted";
const CELL = "px-3 py-2 align-middle text-[13px] text-admin-ink-2";

/**
 * The bridge from imported qualification results to the finals card: pick a
 * target heat and a field size, and the top qualifiers by net time are moved
 * into it (`seedFinalFromResults`).
 *
 * Server-rendered — the standings are a read, the seeding is a form post, and
 * there is no state to hold between the two. The preview table shows the
 * standings at the default field size so the admin sees who a press would move
 * *before* pressing; a different count seeds a different prefix of the same
 * ordering. Unlinked rows stay in the table — hiding them would silently
 * promote the next time down — and are flagged, because the admin has to place
 * those runners by hand.
 */
export function SeedFinalCard({
  locale,
  slug,
  heats,
  qualifiers,
  defaultCount,
  pool,
}: {
  locale: string;
  slug: string;
  heats: HeatWithFill[];
  qualifiers: Qualifier[];
  defaultCount: number;
  pool: number;
}) {
  const unlinked = qualifiers.filter((q) => q.registrationId === null).length;
  // The latest heat is the likeliest final — quals are laid out first, the
  // final is appended after.
  const defaultHeat = heats[heats.length - 1];

  return (
    <section className={adminCard("mt-4 p-4 sm:p-5")} data-admin-seed-final>
      <h2 className={ADMIN_TITLE}>Seed final from results</h2>
      <p className={cn(ADMIN_NOTE, "mt-1.5 max-w-[78ch]")}>
        Moves the fastest finishers from the imported results into the heat you pick — results from
        the target heat itself are ignored, so re-seeding after a corrected import is safe. Nobody
        is emailed until you press re-publish.
      </p>
      {unlinked > 0 ? (
        <p className={cn(ADMIN_NOTE, "mt-2 max-w-[78ch] text-admin-warn")}>
          {plural(unlinked, "result")} in the standings below {unlinked === 1 ? "is" : "are"} not
          linked to any registered runner and cannot be seeded — check the import on the Results
          tab, or move them in by hand below.
        </p>
      ) : null}

      <div className="admin-scroll mt-3 overflow-x-auto rounded-admin-lg border border-admin-line">
        <table className="w-full border-collapse text-left" data-admin-qualifiers>
          <thead className="border-b border-admin-line bg-admin-surface-2">
            <tr>
              <th scope="col" className={HEAD_CELL}>
                #
              </th>
              <th scope="col" className={HEAD_CELL}>
                Runner
              </th>
              <th scope="col" className={HEAD_CELL}>
                From heat
              </th>
              <th scope="col" className={HEAD_CELL}>
                Time
              </th>
              <th scope="col" className={HEAD_CELL}>
                Seedable
              </th>
            </tr>
          </thead>
          <tbody>
            {qualifiers.map((q, i) => (
              <tr
                key={`${q.heatNumber}:${q.bib}`}
                className="border-b border-admin-line/60 last:border-b-0"
              >
                <td className={cn(CELL, "text-admin-ink")}>{i + 1}</td>
                <td className={cn(CELL, "text-admin-ink")}>
                  {q.name}
                  <span className="text-admin-muted"> · {q.gender}</span>
                </td>
                <td className={CELL}>Heat {q.heatNumber}</td>
                <td className={cn(CELL, "font-mono")}>{formatTime(q.timeCs)}</td>
                <td className={CELL}>
                  {q.registrationId ? (
                    <AdminPill tone="ok">yes</AdminPill>
                  ) : (
                    <AdminPill tone="warn" dot>
                      unlinked
                    </AdminPill>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form action={seedFinalFromResults} className="mt-4 flex flex-wrap items-end gap-2.5">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="slug" value={slug} />
        <AdminField label="Seed into" className="w-full sm:w-[280px]">
          <select name="heatId" className={adminInput()} defaultValue={defaultHeat?.id ?? ""}>
            {heats.map((h) => (
              <option key={h.id} value={h.id}>
                Heat {h.number} · {formatHeatTime(h.scheduledAt)} · {h.fill}/{h.capacity}
              </option>
            ))}
          </select>
        </AdminField>
        <AdminField label="Qualifiers" className="w-[104px]">
          <input
            className={adminInput()}
            type="number"
            name="count"
            min={1}
            max={pool}
            defaultValue={defaultCount}
          />
        </AdminField>
        <ConfirmSubmit
          label="Seed final"
          title="Seed the final from results?"
          message="The top qualifiers are moved into the chosen heat — out of whatever heat they are in now. No email goes out until you press re-publish."
          confirmLabel="Seed final"
          danger={false}
          triggerClassName={adminButton("primary")}
        />
      </form>
    </section>
  );
}
