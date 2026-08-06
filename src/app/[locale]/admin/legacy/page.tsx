import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { requireAdmin } from "@/features/admin/action-helpers";
import { AdminPage } from "@/features/admin/components/shell/admin-page";
import { CopyLinkButton } from "@/features/admin/components/copy-link-button";
import { ConfirmSubmit } from "@/features/admin/components/confirm-submit";
import { DownloadLink } from "@/features/admin/components/download-link";
import { NoDatabaseNotice } from "@/features/admin/components/no-database-notice";
import { formatAdminDateTime as fmt } from "@/features/admin/format";
import { removeRunner, removeTeam } from "@/features/admin/legacy-actions";
import { getLegacyOverview } from "@/features/admin/legacy-data";

export default async function AdminLegacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin(locale);

  return (
    <AdminPage title="Warsaw 2026 (legacy)">
      {process.env.DATABASE_URL ? (
        <LegacyBody locale={locale} />
      ) : (
        <NoDatabaseNotice>view teams and runners</NoDatabaseNotice>
      )}
    </AdminPage>
  );
}

async function LegacyBody({ locale }: { locale: string }) {
  const data = await getLegacyOverview();

  return (
    <>
      <div className="iv-notice iv-notice--info">
        The completed first event — the team mile (warsaw-2026). This data is frozen; new events
        live in the mile series.
      </div>

      {/* ---- Teams ---- */}
      <section className="iv-card" style={{ marginTop: 20 }}>
        <div className="iv-section-head">
          <h2 className="iv-section-title">Teams</h2>
          {data.teams.length > 0 ? (
            <DownloadLink href="/api/admin/runners/export?scope=teams">Export Excel</DownloadLink>
          ) : null}
        </div>
        {data.teams.length === 0 ? (
          <p className="iv-note">No teams yet.</p>
        ) : (
          <div className="iv-tablewrap">
            <table className="iv-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Code</th>
                  <th>Roster</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.teams.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td style={{ fontFamily: "var(--font-cta)" }}>{t.code}</td>
                    <td>
                      {t.runnerCount} / {t.size ?? "—"}
                    </td>
                    <td>{t.status}</td>
                    <td>{fmt(t.createdAt)}</td>
                    <td>
                      <div className="iv-inline">
                        <CopyLinkButton code={t.code} />
                        <form action={removeTeam}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="id" value={t.id} />
                          <ConfirmSubmit
                            label="Remove"
                            title="Remove team?"
                            message={`This permanently removes "${t.name}" and its ${t.runnerCount} runner(s). This cannot be undone.`}
                            confirmLabel="Remove team"
                          />
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---- Runners ---- */}
      <section className="iv-card">
        <div className="iv-section-head">
          <h2 className="iv-section-title">Runners</h2>
          {data.runners.length > 0 ? (
            <div className="iv-inline">
              <DownloadLink href="/api/admin/runners/export?scope=runners">
                Export runners
              </DownloadLink>
              <DownloadLink href="/api/admin/runners/export?scope=all">
                Export all sheets
              </DownloadLink>
            </div>
          ) : null}
        </div>
        {data.runners.length === 0 ? (
          <p className="iv-note">No runners yet.</p>
        ) : (
          <div className="iv-tablewrap">
            <table className="iv-table">
              <thead>
                <tr>
                  <th>Runner</th>
                  <th>Contact</th>
                  <th>Type</th>
                  <th>Payment</th>
                  <th>Registered</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.runners.map((r) => (
                  <tr key={r.id}>
                    <td>{r.fullName}</td>
                    <td>
                      {r.email}
                      <div className="iv-cellsub">{r.phone}</div>
                    </td>
                    <td>{r.registrationType.replace("_", " ")}</td>
                    <td>
                      <span
                        className={`iv-pill ${
                          r.paymentStatus === "paid" || r.paymentStatus === "free"
                            ? "iv-pill--ok"
                            : "iv-pill--due"
                        }`}
                      >
                        {r.paymentStatus}
                      </span>
                    </td>
                    <td>{fmt(r.createdAt)}</td>
                    <td>
                      <form action={removeRunner}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="id" value={r.id} />
                        <ConfirmSubmit
                          label="Remove"
                          title="Remove runner?"
                          message={`This permanently removes ${r.fullName} from the event. This cannot be undone.`}
                          confirmLabel="Remove runner"
                        />
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
