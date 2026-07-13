import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { requireAdmin } from "@/features/admin/action-helpers";
import { AdminShell } from "@/features/admin/components/admin-shell";
import { DownloadLink } from "@/features/admin/components/download-link";
import { Stat } from "@/features/admin/components/stat";
import { StatusPill } from "@/features/admin/components/status-pill";
import {
  ageCategoryForDob,
  getEventRoster,
  getRosterStats,
  type ParticipationStatus,
  type RosterRow,
} from "@/features/admin/events-data";
import { formatAdminDateTime as fmt } from "@/features/admin/format";
import { getEventBySlug } from "@/lib/events/registry";
import { Link } from "@/i18n/navigation";

const STATUSES: ParticipationStatus[] = ["registered", "checked_in", "no_show"];

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
  await requireAdmin(locale);

  const event = getEventBySlug(slug);
  if (!event || event.eventType !== "individual") notFound();

  const statusFilter = parseStatus(status);
  const eventDate = new Date(event.date);

  const [roster, stats] = await Promise.all([
    getEventRoster(slug, { status: statusFilter }),
    getRosterStats(slug),
  ]);
  const total = stats.registered + stats.checked_in + stats.no_show;

  return (
    <AdminShell
      locale={locale}
      eyebrow={`Admin · ${event.shortDate}`}
      title={`${event.name} roster`}
      actions={
        <>
          <Link href={`/admin/events/${slug}/checkin`} className="btn btn-red btn-sm">
            Check-in
          </Link>
          <DownloadLink href={`/api/admin/events/${slug}/export`}>Export Excel</DownloadLink>
        </>
      }
    >
      <div className="iv-grid">
        <Stat label="Registered" value={stats.registered} />
        <Stat label="Checked in" value={stats.checked_in} />
        <Stat label="No-show" value={stats.no_show} />
        <Stat label="Total" value={total} />
      </div>

      <div className="iv-inline" style={{ margin: "18px 0" }}>
        <FilterLink href={`/admin/events/${slug}`} active={!statusFilter}>
          All
        </FilterLink>
        {STATUSES.map((s) => (
          <FilterLink
            key={s}
            href={`/admin/events/${slug}?status=${s}`}
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
    </AdminShell>
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
    <Link href={href} className={`btn btn-sm ${active ? "btn-red" : "btn-stroke"}`} style={{ textTransform: "capitalize" }}>
      {children}
    </Link>
  );
}
