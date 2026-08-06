import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { requireAdmin } from "@/features/admin/action-helpers";
import { AdminFlash } from "@/features/admin/components/admin-flash";
import { ConfirmSubmit } from "@/features/admin/components/confirm-submit";
import { HeatBuilder } from "@/features/admin/components/heat-builder";
import { Stat } from "@/features/admin/components/stat";
import { plural } from "@/features/admin/format";
import { generateHeats, publishHeats } from "@/features/admin/heat-actions";
import {
  getEventHeats,
  getSeedPool,
  MAX_GENERATE_HEATS,
  outOfOrderHeats,
} from "@/features/admin/heats-data";
import { instantToWarsawLocal } from "@/lib/events/heat-time";
import {
  getBibPool,
  getEventBySlug,
  getFirstHeatTime,
  getHeatIntervalMinutes,
} from "@/lib/events/registry";

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

export default async function AdminEventHeatsPage({ params, searchParams }: PageProps) {
  const { locale, slug } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  await requireAdmin(locale);

  const event = getEventBySlug(slug);
  if (!event || event.eventType !== "individual") notFound();

  const [heats, seeds] = await Promise.all([getEventHeats(slug), getSeedPool(slug)]);

  const pool = getBibPool(slug);
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
        <div className="iv-notice iv-notice--error">
          Start times are out of order at heat {outOfOrder.join(", ")} — each heat should start after
          the one before it. Publishing is still allowed; check the times first.
        </div>
      ) : null}

      <div className="iv-grid">
        <Stat label="Heats" value={heats.length} />
        {/* The pool is confirmed runners *plus* anyone already seeded, so it is
            not the same number as the roster's "Confirmed" stat. */}
        <Stat label="Seedable" value={seeds.length} />
        <Stat label="Seeded" value={seeded} />
        <Stat label="Unassigned" value={seeds.length - seeded} />
        <Stat label="To notify" value={pendingNotify} />
        <Stat label="Capacity" value={totalCapacity} />
        <Stat label="Bib pool" value={pool} />
      </div>

      {/* ---- generate ---- */}
      <section className="iv-card" style={{ marginTop: 18 }}>
        <h2 className="iv-section-title">{heats.length === 0 ? "Generate heats" : "Add heats"}</h2>
        <p className="iv-note" style={{ marginTop: 4 }}>
          {heats.length === 0
            ? `Start times are prefilled from the event's racing window at ${interval}-minute spacing. Capacity is capped at the ${pool}-bib pool.`
            : `New heats are numbered on from heat ${heats[heats.length - 1].number} — existing heats and their times are left alone.`}
        </p>
        <form action={generateHeats} style={{ marginTop: 12 }}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="slug" value={slug} />
          <div className="iv-inline" style={{ alignItems: "flex-end", gap: 12 }}>
            <label className="block">
              <span className="iv-fieldlabel">Heats</span>
              <input
                className="iv-input"
                type="number"
                name="count"
                min={1}
                max={MAX_GENERATE_HEATS}
                defaultValue={heats.length === 0 ? 9 : 1}
                style={{ width: 90 }}
              />
            </label>
            <label className="block">
              <span className="iv-fieldlabel">Capacity</span>
              <input
                className="iv-input"
                type="number"
                name="capacity"
                min={1}
                max={pool}
                defaultValue={Math.min(12, pool)}
                style={{ width: 110 }}
              />
            </label>
            <label className="block">
              <span className="iv-fieldlabel">First start</span>
              <input
                className="iv-input"
                type="datetime-local"
                name="firstStart"
                defaultValue={firstStartValue}
              />
            </label>
            <label className="block">
              <span className="iv-fieldlabel">Interval (min)</span>
              <input
                className="iv-input"
                type="number"
                name="intervalMinutes"
                min={1}
                defaultValue={interval}
                style={{ width: 110 }}
              />
            </label>
            <button type="submit" className="btn btn-red">
              {heats.length === 0 ? "Generate" : "Add"}
            </button>
          </div>
        </form>
      </section>

      {/* ---- publish ---- */}
      {heats.length > 0 ? (
        <section className="iv-card" style={{ marginTop: 16 }}>
          <div className="iv-section-head">
            <h2 className="iv-section-title">
              {unpublished === heats.length ? "Publish the card" : "Re-publish"}
            </h2>
            <span className="iv-sub">
              {unpublished === 0
                ? "All heats published"
                : `${plural(unpublished, "heat")} still draft`}
            </span>
          </div>
          <p className="iv-note" style={{ marginTop: 4 }}>
            Publishing releases the whole card at once and emails every seeded runner their heat
            number and approximate start time. It is safe to press again after edits — only runners
            whose heat or time has moved, plus anyone never told, are emailed.
          </p>
          <p className="iv-note" style={{ marginTop: 8 }}>
            {notifiable.length === 0
              ? "Nobody is seeded yet, so this only releases the heats — no email goes out."
              : pendingNotify === 0
                ? `All ${plural(notifiable.length, "seeded runner")} already hold a current notice — pressing this emails nobody.`
                : `This will email ${plural(pendingNotify, "runner")} of the ${notifiable.length} seeded.`}
          </p>
          <form action={publishHeats} style={{ marginTop: 12 }}>
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
              triggerClassName="btn btn-red"
            />
          </form>
        </section>
      ) : null}

      {heats.length === 0 && seeds.length === 0 ? (
        <section className="iv-card" style={{ marginTop: 16 }}>
          <p className="iv-note">
            No heats and nobody confirmed yet. Generate the heats now if you like — runners appear
            here as they confirm they are coming.
          </p>
        </section>
      ) : (
        <div style={{ marginTop: 16 }}>
          <HeatBuilder locale={locale} slug={slug} heats={heats} seeds={seeds} pool={pool} />
        </div>
      )}
    </>
  );
}
