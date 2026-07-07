import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import {
  assignBibAndCheckIn,
  markNoShow,
  revertToRegistered,
} from "@/features/admin/checkin-actions";
import {
  getEventRoster,
  getRosterRowById,
  suggestNextBib,
  type ParticipationStatus,
  type RosterRow,
} from "@/features/admin/events-data";
import { verifyEventTicket } from "@/features/ticket/sign";
import { getEventBySlug } from "@/lib/events/registry";
import { getAdminSession } from "@/lib/auth/admin-session";
import { defaultLocale } from "@/lib/i18n/config";

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

const ERROR_TEXT: Record<string, string> = {
  bib_taken: "That bib is already assigned for this event. Choose another.",
  bib: "Enter a valid bib number.",
  input: "Missing runner or event.",
  scan: "Invalid or unverified ticket QR.",
};

export default async function AdminCheckinPage({ params, searchParams }: PageProps) {
  const { locale, slug } = await params;
  const { q, ok, error } = await searchParams;
  setRequestLocale(locale);

  if (!(await getAdminSession())) {
    redirect(locale === defaultLocale ? "/admin/login" : `/${locale}/admin/login`);
  }

  const event = getEventBySlug(slug);
  if (!event || event.eventType !== "individual") notFound();

  const p = (suffix: string) => (locale === defaultLocale ? suffix : `/${locale}${suffix}`);
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

  const nextBib = await suggestNextBib(slug);
  const errorText = scanError ? ERROR_TEXT.scan : error ? ERROR_TEXT[error] : null;

  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap iv-wrap--narrow">
          <div className="iv-toolbar">
            <div>
              <span className="iv-eyebrow">Check-in · {event.shortDate}</span>
              <h1 className="iv-title">{event.name}</h1>
            </div>
            <a href={p(`/admin/events/${slug}`)} className="btn btn-stroke btn-sm">
              Roster
            </a>
          </div>

          {ok ? <div className="iv-notice iv-notice--info">Checked in · bib #{ok}</div> : null}
          {errorText ? <div className="iv-notice iv-notice--error">{errorText}</div> : null}

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
            <RunnerCard key={row.id} row={row} slug={slug} locale={locale} q={query} nextBib={nextBib} />
          ))}
        </div>
      </main>
    </div>
  );
}

function RunnerCard({
  row,
  slug,
  locale,
  q,
  nextBib,
}: {
  row: RosterRow;
  slug: string;
  locale: string;
  q: string;
  nextBib: number;
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
          <span className="iv-sub">Bib #{row.bib} assigned.</span>
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
                defaultValue={row.bib ?? nextBib}
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

function StatusPill({ status }: { status: ParticipationStatus }) {
  const cls =
    status === "checked_in"
      ? "iv-pill--ok"
      : status === "no_show"
        ? "iv-pill--red"
        : "iv-pill--due";
  return <span className={`iv-pill ${cls}`}>{status.replaceAll("_", " ")}</span>;
}
