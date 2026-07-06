import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import {
  ageCategoryForDob,
  getEventRoster,
  getRosterStats,
  type ParticipationStatus,
  type RosterRow,
} from "@/features/admin/events-data";
import { getEventBySlug } from "@/lib/events/registry";
import { getAdminSession } from "@/lib/auth/admin-session";
import { defaultLocale } from "@/lib/i18n/config";

const STATUSES: ParticipationStatus[] = ["registered", "checked_in", "no_show", "cancelled"];

function fmt(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function parseStatus(value: string | undefined): ParticipationStatus | undefined {
  return STATUSES.includes(value as ParticipationStatus) ? (value as ParticipationStatus) : undefined;
}

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ status?: string }>;
};

export default async function AdminEventRosterPage({ params, searchParams }: PageProps) {
  const { locale, slug } = await params;
  const { status } = await searchParams;
  setRequestLocale(locale);

  if (!(await getAdminSession())) {
    redirect(locale === defaultLocale ? "/admin/login" : `/${locale}/admin/login`);
  }

  const event = getEventBySlug(slug);
  if (!event || event.eventType !== "individual") notFound();

  const p = (suffix: string) => (locale === defaultLocale ? suffix : `/${locale}${suffix}`);
  const statusFilter = parseStatus(status);
  const eventDate = new Date(event.date);

  const [roster, stats] = await Promise.all([
    getEventRoster(slug, { status: statusFilter }),
    getRosterStats(slug),
  ]);
  const total = stats.registered + stats.checked_in + stats.no_show + stats.cancelled;

  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap">
          <div className="iv-toolbar">
            <div>
              <span className="iv-eyebrow">Admin · {event.shortDate}</span>
              <h1 className="iv-title">{event.name} roster</h1>
            </div>
            <div className="iv-inline">
              <a href={p(`/admin/events/${slug}/checkin`)} className="btn btn-red btn-sm">
                Check-in
              </a>
              <a href={`/api/admin/events/${slug}/export`} className="btn btn-stroke btn-sm">
                Export Excel
              </a>
              <a href={p("/admin")} className="btn btn-stroke btn-sm">
                Back
              </a>
            </div>
          </div>

          <div className="iv-grid">
            <Stat label="Registered" value={stats.registered} />
            <Stat label="Checked in" value={stats.checked_in} />
            <Stat label="No-show" value={stats.no_show} />
            <Stat label="Total" value={total} />
          </div>

          <div className="iv-inline" style={{ margin: "18px 0" }}>
            <FilterLink href={p(`/admin/events/${slug}`)} active={!statusFilter}>
              All
            </FilterLink>
            {STATUSES.map((s) => (
              <FilterLink
                key={s}
                href={p(`/admin/events/${slug}?status=${s}`)}
                active={statusFilter === s}
              >
                {s.replaceAll("_", " ")} ({stats[s]})
              </FilterLink>
            ))}
          </div>

          <section className="iv-card">
            {roster.length === 0 ? (
              <p className="iv-note">No runners{statusFilter ? " with this status" : ""} yet.</p>
            ) : (
              <div className="iv-tablewrap">
                <table className="iv-table">
                  <thead>
                    <tr>
                      <th>Bib</th>
                      <th>Runner</th>
                      <th>Sex</th>
                      <th>DOB</th>
                      <th>Cat.</th>
                      <th>Club</th>
                      <th>Contact</th>
                      <th>Status</th>
                      <th>Checked in</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((r) => (
                      <RosterRowView key={r.id} row={r} eventDate={eventDate} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function RosterRowView({ row, eventDate }: { row: RosterRow; eventDate: Date }) {
  const name = [row.firstName, row.lastName].filter(Boolean).join(" ") || row.name;
  return (
    <tr>
      <td>{row.bib ?? "—"}</td>
      <td>{name}</td>
      <td>{row.sex ?? "—"}</td>
      <td>{row.dateOfBirth ? row.dateOfBirth.toISOString().slice(0, 10) : "—"}</td>
      <td>{ageCategoryForDob(row.dateOfBirth, eventDate) || "—"}</td>
      <td>{row.club || "—"}</td>
      <td>
        {row.email}
        <div className="iv-cellsub">{row.phone ?? ""}</div>
      </td>
      <td>
        <StatusPill status={row.status} />
      </td>
      <td>{fmt(row.checkedInAt)}</td>
    </tr>
  );
}

function StatusPill({ status }: { status: ParticipationStatus }) {
  const cls =
    status === "checked_in"
      ? "iv-pill--ok"
      : status === "no_show" || status === "cancelled"
        ? "iv-pill--red"
        : "iv-pill--due";
  return <span className={`iv-pill ${cls}`}>{status.replaceAll("_", " ")}</span>;
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <a href={href} className={`btn btn-sm ${active ? "btn-red" : "btn-stroke"}`} style={{ textTransform: "capitalize" }}>
      {children}
    </a>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="iv-info">
      <div className="iv-info__label">{label}</div>
      <div className="iv-info__value">{value}</div>
    </div>
  );
}
