import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { requireAdmin } from "@/features/admin/action-helpers";
import { AdminShell } from "@/features/admin/components/admin-shell";
import {
  assignBibAndCheckIn,
  markNoShow,
  revertToRegistered,
} from "@/features/admin/checkin-actions";
import { StatusPill } from "@/features/admin/components/status-pill";
import {
  getEventRoster,
  getRosterRowById,
  holdsBib,
  suggestNextBib,
  type RosterRow,
} from "@/features/admin/events-data";
import { verifyEventTicket } from "@/features/ticket/sign";
import { getBibPool, getEventBySlug } from "@/lib/events/registry";
import { Link } from "@/i18n/navigation";

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ q?: string; ok?: string; error?: string }>;
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
 * Desk-facing copy for a failed check-in. Bib exhaustion is deliberately absent:
 * it is not an error — check-in succeeds bib-less and reports through `ok`.
 */
function errorText(code: string, pool: number): string | null {
  switch (code) {
    case "bib_held":
      return "Another runner is holding that bib right now. Choose another.";
    case "bib":
      return `Enter a bib number between 1 and ${pool}.`;
    case "bib_race":
      return "Another desk took that bib first. Try again.";
    case "input":
      return "Missing runner or event.";
    case "scan":
      return "Invalid or unverified ticket QR.";
    default:
      return null;
  }
}

export default async function AdminCheckinPage({ params, searchParams }: PageProps) {
  const { locale, slug } = await params;
  const { q, ok, error } = await searchParams;
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
  const nextBib = await suggestNextBib(slug);
  const notice = errorText(scanError ? "scan" : (error ?? ""), pool);

  return (
    <AdminShell
      locale={locale}
      eyebrow={`Check-in · ${event.shortDate}`}
      title={event.name}
      narrow
      actions={
        <Link href={`/admin/events/${slug}`} className="btn btn-stroke btn-sm">
          Roster
        </Link>
      }
    >
      {ok === "pending" ? (
        <div className="iv-notice iv-notice--info">
          Checked in · bib pending. No bibs available — mark a finished heat complete to free some.
        </div>
      ) : ok ? (
        <div className="iv-notice iv-notice--info">Checked in · bib #{ok}</div>
      ) : null}
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
        <StatusPill status={row.status} />
      </div>

      {checkedIn ? (
        <div className="iv-inline" style={{ marginTop: 12 }}>
          <span className="iv-sub">
            {holdsBib(row)
              ? `Bib #${row.bib} leased.`
              : "Present · bib pending — free one by marking a finished heat complete."}
          </span>
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
