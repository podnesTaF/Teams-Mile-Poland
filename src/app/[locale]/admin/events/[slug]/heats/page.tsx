import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { requireAdmin } from "@/features/admin/action-helpers";
import { AdminFlash } from "@/features/admin/components/admin-flash";
import { ConfirmSubmit } from "@/features/admin/components/confirm-submit";
import { HeatBuilder } from "@/features/admin/components/heat-builder";
import { adminButton } from "@/features/admin/components/shell/admin-button";
import { ADMIN_NOTE, ADMIN_TITLE, adminCard } from "@/features/admin/components/shell/admin-card";
import { AdminEmptyState } from "@/features/admin/components/shell/admin-empty-state";
import { AdminField, adminInput } from "@/features/admin/components/shell/admin-field";
import { AdminNotice } from "@/features/admin/components/shell/admin-notice";
import { AdminStat } from "@/features/admin/components/shell/admin-stat";
import { plural } from "@/features/admin/format";
import { generateHeats, publishHeats } from "@/features/admin/heat-actions";
import { SeedFinalCard } from "@/features/admin/components/seed-final-card";
import {
  getEventHeats,
  getSeedPool,
  MAX_GENERATE_HEATS,
  outOfOrderHeats,
} from "@/features/admin/heats-data";
import { getResultsState, topQualifiers } from "@/features/admin/results-import/data";
import { instantToWarsawLocal } from "@/lib/events/heat-time";
import {
  getBibPool,
  getEventBySlug,
  getFirstHeatTime,
  getHeatIntervalMinutes,
} from "@/lib/events/registry";
import { cn } from "@/lib/utils";

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{
    ok?: string;
    error?: string;
    n?: string;
    /** Publish counts, carried back by `publishHeats`. */
    published?: string;
    notified?: string;
    skipped?: string;
    failed?: string;
  }>;
};

/**
 * The Heats tab: generate the card, seed it, release it.
 *
 * Restyled onto the Tailwind admin layer in slice #42 — the actions, the reads
 * and every count on this page are exactly what they were. The shell (dark root,
 * sidebar) comes from the admin layout and the event header and tabs from the
 * event layout, so this page is only its own stats, forms and builder.
 */
export default async function AdminEventHeatsPage({ params, searchParams }: PageProps) {
  const { locale, slug } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  await requireAdmin(locale);

  const event = getEventBySlug(slug);
  if (!event || event.eventType !== "individual") notFound();

  const [heats, seeds, resultsState] = await Promise.all([
    getEventHeats(slug),
    getSeedPool(slug),
    getResultsState(slug),
  ]);

  const pool = getBibPool(slug);

  // The seed-final bridge appears once the timing system has reported
  // finishers and there is a card to seed into. The preview is the standings
  // at the default field size — the same prefix the button's default press
  // would move.
  const importedFinishers = resultsState.reduce((sum, h) => sum + h.finishers, 0);
  const defaultFinalSize = Math.min(12, pool);
  const qualifiers =
    importedFinishers > 0 && heats.length > 0
      ? await topQualifiers(slug, { limit: defaultFinalSize })
      : [];
  const interval = getHeatIntervalMinutes(slug);
  const firstHeat = getFirstHeatTime(slug);
  const seeded = seeds.filter((s) => s.heatId).length;
  const outOfOrder = outOfOrderHeats(heats);
  const totalCapacity = heats.reduce((sum, h) => sum + h.capacity, 0);

  // Prefill the next generated heat one interval past the latest heat already on
  // the card, so adding to an existing card does not land on top of heat 1. With
  // no heats yet, start where the racing window opens; if the event has no
  // configured window there is nothing honest to guess, so ask.
  const latest = heats.reduce((max, h) => Math.max(max, h.scheduledAt.getTime()), 0);
  const firstStartValue = latest
    ? instantToWarsawLocal(new Date(latest + interval * 60_000))
    : firstHeat
      ? `${event.date}T${firstHeat}`
      : "";

  // How many seeded runners this press would actually email, so the button can
  // say so before it is pressed rather than after. Mirrors the mailing's own
  // filter: a seeded no-show stays on the card to be taken off, but is not mailed.
  const notifiable = seeds.filter((s) => s.heatId && s.status !== "no_show");
  const pendingNotify = notifiable.filter((s) => s.notifyState !== "notified").length;
  const unpublished = heats.filter((h) => h.state === "draft").length;

  return (
    <>
      <AdminFlash query={query} context={{ slug }} />

      {outOfOrder.length > 0 ? (
        <AdminNotice className="mb-4">
          Start times are out of order at heat {outOfOrder.join(", ")} — each heat should start after
          the one before it. Publishing is still allowed; check the times first.
        </AdminNotice>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-7">
        <AdminStat label="Heats" value={heats.length} />
        {/* The pool is confirmed runners *plus* anyone already seeded, so it is
            not the same number as the roster's "Confirmed" stat. */}
        <AdminStat label="Seedable" value={seeds.length} />
        <AdminStat label="Seeded" value={seeded} />
        <AdminStat label="Unassigned" value={seeds.length - seeded} />
        <AdminStat label="To notify" value={pendingNotify} />
        <AdminStat label="Capacity" value={totalCapacity} />
        <AdminStat label="Bib pool" value={pool} />
      </div>

      {/* ---- generate ---- */}
      <section className={adminCard("mt-4 p-4 sm:p-5")}>
        <h2 className={ADMIN_TITLE}>{heats.length === 0 ? "Generate heats" : "Add heats"}</h2>
        <p className={cn(ADMIN_NOTE, "mt-1.5 max-w-[78ch]")}>
          {heats.length === 0
            ? `Start times are prefilled from the event's racing window at ${interval}-minute spacing. Capacity is capped at the ${pool}-bib pool.`
            : `New heats are numbered on from heat ${heats[heats.length - 1].number} — existing heats and their times are left alone.`}
        </p>
        <form action={generateHeats} className="mt-4 flex flex-wrap items-end gap-2.5">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="slug" value={slug} />
          <AdminField label="Heats" className="w-[88px]">
            <input
              className={adminInput()}
              type="number"
              name="count"
              min={1}
              max={MAX_GENERATE_HEATS}
              defaultValue={heats.length === 0 ? 9 : 1}
            />
          </AdminField>
          <AdminField label="Capacity" className="w-[104px]">
            <input
              className={adminInput()}
              type="number"
              name="capacity"
              min={1}
              max={pool}
              defaultValue={Math.min(12, pool)}
            />
          </AdminField>
          <AdminField label="First start" className="w-full sm:w-[210px]">
            <input
              className={adminInput()}
              type="datetime-local"
              name="firstStart"
              defaultValue={firstStartValue}
            />
          </AdminField>
          <AdminField label="Interval (min)" className="w-[120px]">
            <input
              className={adminInput()}
              type="number"
              name="intervalMinutes"
              min={1}
              defaultValue={interval}
            />
          </AdminField>
          <button type="submit" className={adminButton("primary")}>
            {heats.length === 0 ? "Generate" : "Add"}
          </button>
        </form>
      </section>

      {/* ---- publish ---- */}
      {heats.length > 0 ? (
        <section className={adminCard("mt-4 p-4 sm:p-5")}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className={ADMIN_TITLE}>
              {unpublished === heats.length ? "Publish the card" : "Re-publish"}
            </h2>
            <p
              className={cn(
                "font-mono text-[10px] font-medium uppercase tracking-[0.16em]",
                unpublished === 0 ? "text-admin-ok" : "text-admin-warn",
              )}
            >
              {unpublished === 0 ? "All heats published" : `${plural(unpublished, "heat")} still draft`}
            </p>
          </div>
          <p className={cn(ADMIN_NOTE, "mt-1.5 max-w-[78ch]")}>
            Publishing releases the whole card at once and emails every seeded runner their heat
            number and approximate start time. It is safe to press again after edits — only runners
            whose heat or time has moved, plus anyone never told, are emailed.
          </p>
          <p className={cn(ADMIN_NOTE, "mt-2 max-w-[78ch] text-admin-ink-2")}>
            {notifiable.length === 0
              ? "Nobody is seeded yet, so this only releases the heats — no email goes out."
              : pendingNotify === 0
                ? `All ${plural(notifiable.length, "seeded runner")} already hold a current notice — pressing this emails nobody.`
                : `This will email ${plural(pendingNotify, "runner")} of the ${notifiable.length} seeded.`}
          </p>
          <form action={publishHeats} className="mt-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="slug" value={slug} />
            <ConfirmSubmit
              label={unpublished === heats.length ? "Publish & notify" : "Re-publish & notify"}
              title={pendingNotify === 0 ? "Publish the card?" : `Email ${pendingNotify}?`}
              message={
                pendingNotify === 0
                  ? "Every heat becomes published. No email goes out — nobody's heat or time has changed since they were last told."
                  : `${plural(pendingNotify, "runner")} will be emailed their heat and approximate start time. Runners whose heat and time are unchanged are left alone.`
              }
              confirmLabel="Publish"
              danger={false}
              triggerClassName={adminButton("primary")}
            />
          </form>
        </section>
      ) : null}

      {qualifiers.length > 0 ? (
        <SeedFinalCard
          locale={locale}
          slug={slug}
          heats={heats}
          qualifiers={qualifiers}
          defaultCount={defaultFinalSize}
          pool={pool}
        />
      ) : null}

      {heats.length === 0 && seeds.length === 0 ? (
        <div className="mt-4">
          <AdminEmptyState title="No heats generated yet">
            Nobody has confirmed they are coming yet either. Lay the card out now if you like — use{" "}
            <strong className="font-semibold text-admin-ink-2">Generate heats</strong> above — and
            runners appear here to be seeded as they confirm.
          </AdminEmptyState>
        </div>
      ) : (
        <div className="mt-4">
          <HeatBuilder locale={locale} slug={slug} heats={heats} seeds={seeds} pool={pool} />
        </div>
      )}
    </>
  );
}
