import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { requireAdmin } from "@/features/admin/action-helpers";
import { AdminShell } from "@/features/admin/components/admin-shell";
import {
  assignBibAndCheckIn,
  assignPendingBib,
  markNoShow,
  revertToRegistered,
} from "@/features/admin/checkin-actions";
import { checkedInText, checkinErrorText, plural } from "@/features/admin/checkin-copy";
import { awaitingBib, HeatDesk, RaceMorningLists } from "@/features/admin/components/race-morning";
import { StatusPill } from "@/features/admin/components/status-pill";
import {
  getEventRoster,
  getRosterRowById,
  holdsBib,
  suggestNextBib,
  type RosterRow,
} from "@/features/admin/events-data";
import { getEventHeats } from "@/features/admin/heats-data";
import { verifyEventTicket } from "@/features/ticket/sign";
import { formatHeatTime } from "@/lib/events/heat-time";
import { getBibPool, getEventBySlug } from "@/lib/events/registry";
import { Link } from "@/i18n/navigation";

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{
    q?: string;
    ok?: string;
    error?: string;
    /** Walk-up placement: a heat number, or `none` for Unplaced. */
    heat?: string;
    /** Bib counts carried back by finish / un-finish. */
    returned?: string;
    released?: string;
    /** Bibs that blocked an un-finish, comma separated. */
    bibs?: string;
  }>;
};

/** Extract { registrationId, sig } from a scanned ticket URL, or null. */
function parseScannedTicket(value: string): { registrationId: string; sig: string } | null {
  const idMatch = value.match(/\/tickets\/([^/?#]+)/);
  const sigMatch = value.match(/[?&]s=([^&#]+)/);
  if (!idMatch || !sigMatch) return null;
  return {
    registrationId: decodeURIComponent(idMatch[1]),
    sig: decodeURIComponent(sigMatch[1]),
  };
}

/**
 * Confirmation copy for a completed action. Check-in itself is worded by
 * {@link checkedInText}, shared with the ticket-page panel; the heat presses are
 * desk-only and worded here.
 */
function okText(
  code: string,
  q: { heat?: string; returned?: string; released?: string },
): string | null {
  switch (code) {
    case "":
      return null;
    case "finished":
      return `Heat finished — ${plural(Number(q.returned ?? 0), "bib")} back in the pool.`;
    case "unfinished":
      return `Heat re-opened — ${plural(Number(q.released ?? 0), "bib")} re-leased to its runners.`;
    default:
      return checkedInText(code, q.heat);
  }
}

export default async function AdminCheckinPage({ params, searchParams }: PageProps) {
  const { locale, slug } = await params;
  const { q, ok, error, heat, returned, released, bibs } = await searchParams;
  setRequestLocale(locale);
  await requireAdmin(locale);

  const event = getEventBySlug(slug);
  if (!event || event.eventType !== "individual") notFound();

  const query = q?.trim() ?? "";

  // Resolve results: a scanned/pasted ticket URL resolves to one verified
  // runner; otherwise free-text search over name / email / bib.
  let results: RosterRow[] = [];
  let scanError = false;
  if (query) {
    const scanned = parseScannedTicket(query);
    if (scanned) {
      if (verifyEventTicket(scanned.registrationId, scanned.sig)) {
        const row = await getRosterRowById(slug, scanned.registrationId);
        results = row ? [row] : [];
      } else {
        scanError = true;
      }
    } else {
      results = await getEventRoster(slug, { q: query });
    }
  }

  const pool = getBibPool(slug);
  const [nextBib, heats, checkedIn] = await Promise.all([
    suggestNextBib(slug),
    getEventHeats(slug),
    getEventRoster(slug, { status: "checked_in" }),
  ]);
  const notice = checkinErrorText(scanError ? "scan" : (error ?? ""), { pool, bibs });
  const confirmation = okText(ok ?? "", { heat, returned, released });

  return (
    <AdminShell
      eyebrow={`Check-in · ${event.shortDate}`}
      title={event.name}
      actions={
        <>
          <Link href={`/admin/events/${slug}`} className="btn btn-stroke btn-sm">
            Roster
          </Link>
          <Link href={`/admin/events/${slug}/heats`} className="btn btn-stroke btn-sm">
            Heats
          </Link>
        </>
      }
    >
      {confirmation ? <div className="iv-notice iv-notice--info">{confirmation}</div> : null}
      {notice ? <div className="iv-notice iv-notice--error">{notice}</div> : null}

      {nextBib === null ? (
        <div className="iv-notice iv-notice--error">
          All {pool} bibs are out. Check-in still works — mark a finished heat complete to free
          bibs.
        </div>
      ) : null}

      <form method="get" className="iv-card">
        <span className="iv-fieldlabel">Search name / email / bib, or scan a ticket QR</span>
        <input
          className="iv-input"
          name="q"
          defaultValue={query}
          placeholder="e.g. Kowalski, ola@…, 12, or paste ticket link"
          autoFocus
        />
        <div className="iv-actions">
          <button type="submit" className="btn btn-red">
            Find
          </button>
        </div>
      </form>

      {query && results.length === 0 && !scanError ? (
        <p className="iv-note">No matching runners.</p>
      ) : null}

      {results.map((row) => (
        <RunnerCard
          key={row.id}
          row={row}
          slug={slug}
          locale={locale}
          q={query}
          nextBib={nextBib}
          pool={pool}
        />
      ))}

      <RaceMorningLists
        locale={locale}
        slug={slug}
        q={query}
        checkedIn={checkedIn}
        bibAvailable={nextBib !== null}
      />

      <HeatDesk locale={locale} slug={slug} heats={heats} />
    </AdminShell>
  );
}

function RunnerCard({
  row,
  slug,
  locale,
  q,
  nextBib,
  pool,
}: {
  row: RosterRow;
  slug: string;
  locale: string;
  q: string;
  nextBib: number | null;
  pool: number;
}) {
  const name = [row.firstName, row.lastName].filter(Boolean).join(" ") || row.name;
  const checkedIn = row.status === "checked_in";
  // Holding no bib is not the same as needing one — a runner whose heat has been
  // marked finished has run, and must not be handed a fresh number (ADR 0003).
  const waiting = awaitingBib(row);

  return (
    <section className="iv-card" style={{ marginTop: 16 }}>
      <div className="iv-section-head">
        <div>
          <h2 className="iv-section-title">{name}</h2>
          <div className="iv-cellsub">
            {row.email}
            {row.club ? ` · ${row.club}` : ""}
          </div>
        </div>
        <div className="iv-inline" style={{ gap: 8 }}>
          {/* The desk reads the heat off the card, so a runner can be told where
              to stand at the moment they are chipped. */}
          <span className="iv-pill">
            {row.heatNumber === null
              ? "no heat"
              : `heat ${row.heatNumber}${
                  row.heatScheduledAt ? ` · ${formatHeatTime(row.heatScheduledAt)}` : ""
                }`}
          </span>
          <StatusPill status={row.status} />
        </div>
      </div>

      {checkedIn ? (
        <div className="iv-inline" style={{ marginTop: 12, gap: 12 }}>
          <span className="iv-sub">
            {holdsBib(row)
              ? `Bib #${row.bib} leased.`
              : waiting
                ? "Present · bib pending."
                : `Ran in heat ${row.heatNumber} · bib ${row.bib ?? "—"} returned to the pool.`}
          </span>
          {waiting ? (
            <ActionForm action={assignPendingBib} slug={slug} locale={locale} q={q} regId={row.id}>
              <button type="submit" className="btn btn-red btn-sm" disabled={nextBib === null}>
                {nextBib === null ? "No bib free" : `Assign bib ${nextBib}`}
              </button>
            </ActionForm>
          ) : null}
          <ActionForm action={revertToRegistered} slug={slug} locale={locale} q={q} regId={row.id}>
            <button type="submit" className="iv-linkbtn">
              Undo check-in
            </button>
          </ActionForm>
        </div>
      ) : (
        <div className="iv-inline" style={{ marginTop: 12, alignItems: "flex-end", gap: 12 }}>
          <form action={assignBibAndCheckIn} className="iv-inline" style={{ alignItems: "flex-end", gap: 12 }}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="registrationId" value={row.id} />
            <input type="hidden" name="q" value={q} />
            <label className="block">
              <span className="iv-fieldlabel">Bib</span>
              <input
                className="iv-input"
                name="bib"
                type="number"
                min={1}
                max={pool}
                placeholder={nextBib === null ? "none free" : undefined}
                defaultValue={nextBib ?? ""}
                style={{ width: 120 }}
              />
            </label>
            <button type="submit" className="btn btn-red">
              Check in
            </button>
          </form>
          <ActionForm action={markNoShow} slug={slug} locale={locale} q={q} regId={row.id}>
            <button type="submit" className="btn btn-stroke">
              No-show
            </button>
          </ActionForm>
        </div>
      )}
    </section>
  );
}

function ActionForm({
  action,
  slug,
  locale,
  q,
  regId,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  slug: string;
  locale: string;
  q: string;
  regId: string;
  children: React.ReactNode;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="registrationId" value={regId} />
      <input type="hidden" name="q" value={q} />
      {children}
    </form>
  );
}
