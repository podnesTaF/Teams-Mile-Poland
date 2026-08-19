import { AlertTriangle } from "lucide-react";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { requireAdmin } from "@/features/admin/action-helpers";
import { AdminFlash } from "@/features/admin/components/admin-flash";
import { DeskSearch } from "@/features/admin/components/checkin/desk-search";
import { deskButton } from "@/features/admin/components/checkin/desk-ui";
import {
  HEAT_DESK_ID,
  HeatDesk,
  RaceMorningLists,
} from "@/features/admin/components/checkin/race-morning";
import { RunnerCard } from "@/features/admin/components/checkin/runner-card";
import { AdminEmptyState } from "@/features/admin/components/shell/admin-empty-state";
import { getEventRoster, getRosterRowById, suggestNextBib, type RosterRow } from "@/features/admin/events-data";
import { getEventHeats } from "@/features/admin/heats-data";
import { verifyEventTicket } from "@/features/ticket/sign";
import { Link } from "@/i18n/navigation";
import { userCan } from "@/lib/auth/user-session";
import { getBibPool, getEventBySlug } from "@/lib/events/registry";

/**
 * The check-in desk, designed for the way it is used: standing in the start area
 * on race morning with a phone.
 *
 * So the page is a single column of full-width cards with 48px controls, the
 * search field stays on screen while everything below it scrolls, and the two
 * runner states — about to be checked in, already wearing a bib — are told apart
 * by colour and by the size of the bib before a word is read.
 *
 * The mechanics are untouched (PRD #34, slice #43): the same GET search over name
 * / email / bib with the same signature check on a pasted ticket link, the same
 * check-in / no-show / undo / assign-pending-bib forms, the same heat finish and
 * un-finish, and the same copy — which now reaches the admin through the shared
 * flash banner rather than through this page's own notice divs.
 */

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

export default async function AdminCheckinPage({ params, searchParams }: PageProps) {
  const { locale, slug } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const actor = await requireAdmin(locale);
  // The desk renders for any admin level — a view-only admin watching the tab
  // is a legitimate read — but every press on it is a `checkin` action, so
  // without that level the page is the lists and none of the buttons.
  const canCheckin = userCan(actor, "checkin");

  const event = getEventBySlug(slug);
  if (!event || event.eventType !== "individual") notFound();

  const q = query.q?.trim() ?? "";

  // Resolve results: a scanned/pasted ticket URL resolves to one verified
  // runner; otherwise free-text search over name / email / bib.
  let results: RosterRow[] = [];
  let scanError = false;
  if (q) {
    const scanned = parseScannedTicket(q);
    if (scanned) {
      if (verifyEventTicket(scanned.registrationId, scanned.sig)) {
        const row = await getRosterRowById(slug, scanned.registrationId);
        results = row ? [row] : [];
      } else {
        scanError = true;
      }
    } else {
      results = await getEventRoster(slug, { q });
    }
  }

  const pool = getBibPool(slug);
  const [nextBib, heats, checkedIn] = await Promise.all([
    suggestNextBib(slug),
    getEventHeats(slug),
    getEventRoster(slug, { status: "checked_in" }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      {/* A failed signature on a pasted link is not an action's redirect, so it is
          handed to the banner as the code the desk's copy already words. */}
      <AdminFlash query={scanError ? { ...query, error: "scan" } : query} context={{ slug }} />

      {nextBib === null ? <BibsExhausted pool={pool} /> : null}

      <DeskSearch query={q} />

      {/* The scanner is `checkin`-gated, so it is only offered to a level that
          can open it. */}
      {canCheckin ? (
        <div className="flex justify-end">
          <Link href="/admin/scan" className={deskButton("stroke")}>
            Scan a ticket QR
          </Link>
        </div>
      ) : null}

      {results.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {results.map((row) => (
            <RunnerCard
              key={row.id}
              row={row}
              slug={slug}
              locale={locale}
              q={q}
              nextBib={nextBib}
              pool={pool}
              canCheckin={canCheckin}
            />
          ))}
        </ul>
      ) : null}

      {q && results.length === 0 && !scanError ? (
        <AdminEmptyState title={`Nothing matches “${q}”`}>
          Try a surname, an email address, or a bib number — a recycled number finds only the
          runner wearing it right now. A ticket link has to be pasted whole, signature and all.
        </AdminEmptyState>
      ) : null}

      {/* Pre-race is *both* halves of the condition: no search yet **and** nobody
          through the desk. Once either is true the working lists are what the desk
          wants below the results — including their own "nobody is waiting" lines,
          which are information at 08:00 and not an empty screen. */}
      {!q && checkedIn.length === 0 ? (
        <AdminEmptyState title="Nobody has checked in yet">
          Find a runner in the search field above — surname, email, bib, or the link pasted
          straight out of their ticket email — and hand them the bib it suggests. The waiting list
          and the unplaced list fill in as people come through.
        </AdminEmptyState>
      ) : (
        <RaceMorningLists
          locale={locale}
          slug={slug}
          q={q}
          checkedIn={checkedIn}
          bibAvailable={nextBib !== null}
          canCheckin={canCheckin}
        />
      )}

      <HeatDesk locale={locale} slug={slug} heats={heats} canCheckin={canCheckin} />
    </div>
  );
}

/**
 * Every number in the pool is out on loan.
 *
 * Loud, because it changes what the next press does — check-in still succeeds, but
 * the runner leaves the desk without a bib (ADR 0003) — and because the fix is
 * somewhere else on the page, so it carries the jump to it.
 */
function BibsExhausted({ pool }: { pool: number }) {
  return (
    <div
      role="status"
      data-desk-bibs-exhausted
      className="rounded-admin-lg border border-admin-accent bg-admin-accent-soft p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-admin-accent" aria-hidden />
        <div className="min-w-0">
          <p className="font-sans text-[16px] font-semibold normal-case not-italic leading-tight text-admin-ink">
            All {pool} bibs are out
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-admin-ink-2">
            Check-in still works — runners are marked present with a bib pending and join the
            waiting list. Mark a finished heat complete to free bibs.
          </p>
          <a href={`#${HEAT_DESK_ID}`} className={deskButton("primary", "mt-3.5")}>
            Free bibs at the heat desk
          </a>
        </div>
      </div>
    </div>
  );
}
