import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { requireAdmin } from "@/features/admin/action-helpers";
import { AdminFlash } from "@/features/admin/components/admin-flash";
import { ConfirmSubmit } from "@/features/admin/components/confirm-submit";
import { StatusPill } from "@/features/admin/components/status-pill";
import {
  ageCategoryForDob,
  getEventRoster,
  getRosterStats,
  type ParticipationStatus,
  type RosterRow,
} from "@/features/admin/events-data";
import { formatAdminDateTime as fmt } from "@/features/admin/format";
import { removeRegistration } from "@/features/admin/roster-actions";
import { getEventBySlug } from "@/lib/events/registry";
import { Link } from "@/i18n/navigation";

const STATUSES: ParticipationStatus[] = ["registered", "confirmed", "checked_in", "no_show"];

function parseStatus(value: string | undefined): ParticipationStatus | undefined {
  return STATUSES.includes(value as ParticipationStatus) ? (value as ParticipationStatus) : undefined;
}

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ status?: string; msg?: string }>;
};

export default async function AdminEventRosterPage({ params, searchParams }: PageProps) {
  const { locale, slug } = await params;
  const query = await searchParams;
  const { status } = query;
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

  return (
    <>
      <AdminFlash query={query} context={{ slug }} />

      {/* The per-status totals live in the event header now (slice #39); the
          filter chips keep their own counts because they are the control. */}
      <div className="iv-inline" style={{ marginBottom: 18 }}>
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
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {roster.map((r) => (
                  <RosterRowView
                    key={r.id}
                    row={r}
                    eventDate={eventDate}
                    slug={slug}
                    locale={locale}
                    statusFilter={statusFilter}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function RosterRowView({
  row,
  eventDate,
  slug,
  locale,
  statusFilter,
}: {
  row: RosterRow;
  eventDate: Date;
  slug: string;
  locale: string;
  statusFilter: ParticipationStatus | undefined;
}) {
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
      <td>
        <form action={removeRegistration}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="registrationId" value={row.id} />
          {statusFilter ? <input type="hidden" name="status" value={statusFilter} /> : null}
          <ConfirmSubmit
            label="Remove"
            title="Remove this registration?"
            message={`This permanently deletes ${name}'s registration for this event. Use it for duplicates and withdrawal requests. This cannot be undone.`}
            confirmLabel="Remove"
          />
        </form>
      </td>
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
