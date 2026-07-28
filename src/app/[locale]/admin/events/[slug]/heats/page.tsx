import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { requireAdmin } from "@/features/admin/action-helpers";
import { AdminShell } from "@/features/admin/components/admin-shell";
import { HeatBuilder } from "@/features/admin/components/heat-builder";
import { Stat } from "@/features/admin/components/stat";
import { generateHeats } from "@/features/admin/heat-actions";
import { instantToWarsawLocal } from "@/features/admin/heat-time";
import {
  getEventHeats,
  getSeedPool,
  MAX_GENERATE_HEATS,
  outOfOrderHeats,
} from "@/features/admin/heats-data";
import {
  getBibPool,
  getEventBySlug,
  getFirstHeatTime,
  getHeatIntervalMinutes,
} from "@/lib/events/registry";
import { Link } from "@/i18n/navigation";

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ ok?: string; error?: string; n?: string }>;
};

/** Desk-facing copy for a refused edit. */
function errorText(code: string, pool: number): string | null {
  switch (code) {
    case "count":
      return `Enter how many heats to generate (1–${MAX_GENERATE_HEATS}).`;
    case "capacity":
      return `Capacity must be between 1 and ${pool} — a heat cannot be larger than the bib pool.`;
    case "interval":
      return "Enter the spacing between heats in minutes.";
    case "time":
      return "Enter a valid start time.";
    case "missing":
      return "That heat no longer exists — it may have been deleted in another tab.";
    case "nochange":
      return "Nothing to save — fill in a start time or a capacity.";
    case "noselection":
      return "Select some runners first.";
    case "noheat":
      return "Pick a heat to move them into.";
    case "input":
      return "Missing event or heat.";
    default:
      return null;
  }
}

/** Confirmation copy for a completed edit. `n` is the row count where relevant. */
function okText(code: string, n: string | undefined): string | null {
  const count = n ?? "0";
  switch (code) {
    case "generated":
      return `Generated ${count} heat${count === "1" ? "" : "s"}.`;
    case "updated":
      return "Heat updated.";
    case "deleted":
      return "Heat deleted — its runners are back in Unassigned.";
    case "assigned":
      return `Moved ${count} runner${count === "1" ? "" : "s"}.`;
    case "unassigned":
      return `Unassigned ${count} runner${count === "1" ? "" : "s"}.`;
    default:
      return null;
  }
}

export default async function AdminEventHeatsPage({ params, searchParams }: PageProps) {
  const { locale, slug } = await params;
  const { ok, error, n } = await searchParams;
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

  const notice = errorText(error ?? "", pool);
  const confirmation = okText(ok ?? "", n);

  return (
    <AdminShell
      locale={locale}
      eyebrow={`Heats · ${event.shortDate}`}
      title={`${event.name} heats`}
      actions={
        <>
          <Link href={`/admin/events/${slug}`} className="btn btn-stroke btn-sm">
            Roster
          </Link>
          <Link href={`/admin/events/${slug}/checkin`} className="btn btn-stroke btn-sm">
            Check-in
          </Link>
        </>
      }
    >
      {confirmation ? <div className="iv-notice iv-notice--info">{confirmation}</div> : null}
      {notice ? <div className="iv-notice iv-notice--error">{notice}</div> : null}
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
    </AdminShell>
  );
}
