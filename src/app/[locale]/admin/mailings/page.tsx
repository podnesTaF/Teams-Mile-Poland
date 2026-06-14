import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { ConfirmSubmit } from "@/features/admin/components/confirm-submit";
import { RecipientMultiselect } from "@/features/admin/components/recipient-multiselect";
import {
  runDueMailingsAction,
  sendBroadcastAction,
  sendKindNowAction,
  sendTestEmailAction,
} from "@/features/mailings/actions";
import { getMailingsOverview, listRegistrations, type MailingRow } from "@/features/mailings/data";
import { TEST_EMAIL_OPTIONS } from "@/features/mailings/test-send";
import { getAdminSession } from "@/lib/auth/admin-session";
import { defaultLocale } from "@/lib/i18n/config";

function fmtDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

const SEGMENT_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All runners" },
  { value: "captains", label: "Captains" },
  { value: "team_members", label: "Team members" },
  { value: "free_agents", label: "Free agents" },
];

export default async function MailingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  const { locale } = await params;
  const { msg } = await searchParams;
  setRequestLocale(locale);

  if (!(await getAdminSession())) {
    redirect(locale === defaultLocale ? "/admin/login" : `/${locale}/admin/login`);
  }

  const adminHref = locale === defaultLocale ? "/admin" : `/${locale}/admin`;

  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap">
          <div className="iv-toolbar">
            <div>
              <span className="iv-eyebrow">Admin</span>
              <h1 className="iv-title">Mailings</h1>
            </div>
            <a href={adminHref} className="btn btn-stroke btn-sm">
              ← Dashboard
            </a>
          </div>

          {msg ? <div className="iv-notice iv-notice--info">{msg}</div> : null}

          {process.env.DATABASE_URL ? (
            <MailingsBody locale={locale} />
          ) : (
            <div className="iv-notice iv-notice--info">
              No database connected. Set <code>DATABASE_URL</code> to manage mailings.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

async function MailingsBody({ locale }: { locale: string }) {
  const { rows, past, totalRunners } = await getMailingsOverview(new Date());
  const registrations = await listRegistrations();

  return (
    <>
      {/* ---- Lifecycle chain ---- */}
      <section className="iv-card" style={{ marginTop: 20 }}>
        <div className="iv-toolbar" style={{ marginBottom: 12 }}>
          <h2 className="iv-section-title">Lifecycle chain</h2>
          <form action={runDueMailingsAction}>
            <input type="hidden" name="locale" value={locale} />
            <ConfirmSubmit
              label="Run due mailings now"
              title="Run due mailings?"
              message={`Send every lifecycle email that is currently due to all eligible runners (${totalRunners} registered). Already-sent emails are skipped.`}
              confirmLabel="Run now"
              danger={false}
            />
          </form>
        </div>

        <div className="iv-tablewrap">
          <table className="iv-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Scheduled</th>
                <th>Status</th>
                <th>Eligible</th>
                <th>Sent</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <LifecycleRowView key={r.kind} row={r} locale={locale} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="iv-note">
          Scheduled emails send automatically via the daily cron (<code>/api/cron/mailings</code>); use
          “Send now” to dispatch a specific email immediately. Each email reaches a runner at most once.
        </p>
      </section>

      {/* ---- Broadcast composer ---- */}
      <section className="iv-card">
        <h2 className="iv-section-title">Send a broadcast</h2>
        <form action={sendBroadcastAction} className="iv-editmodal__form" style={{ marginTop: 14 }}>
          <input type="hidden" name="locale" value={locale} />
          <div>
            <label className="iv-fieldlabel" htmlFor="bc-subject">
              Subject
            </label>
            <input id="bc-subject" name="subject" className="iv-input" required maxLength={160} />
          </div>
          <div>
            <label className="iv-fieldlabel" htmlFor="bc-segment">
              Audience
            </label>
            <select id="bc-segment" name="segment" className="iv-input" defaultValue="all">
              {SEGMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="iv-fieldlabel" htmlFor="bc-body">
              Message (HTML allowed)
            </label>
            <textarea
              id="bc-body"
              name="body"
              required
              rows={8}
              className="iv-input"
              style={{ height: "auto", padding: "12px 14px", lineHeight: 1.5 }}
            />
          </div>
          <div className="iv-actions">
            <ConfirmSubmit
              label="Send broadcast"
              title="Send broadcast?"
              message="This emails the selected audience immediately. Double-check the subject and message."
              confirmLabel="Send broadcast"
              danger={false}
            />
          </div>
        </form>
      </section>

      {/* ---- Test a template ---- */}
      <section className="iv-card">
        <h2 className="iv-section-title">Test an email template</h2>
        <p className="iv-note" style={{ marginTop: 4 }}>
          Pick a template and the registered people to send it to. Each recipient gets the real
          template rendered with their own data, subject prefixed with <code>[TEST]</code>. Test
          sends are never logged, so they don’t affect the real lifecycle schedule.
        </p>
        <form action={sendTestEmailAction} className="iv-editmodal__form" style={{ marginTop: 14 }}>
          <input type="hidden" name="locale" value={locale} />
          <div>
            <label className="iv-fieldlabel" htmlFor="test-kind">
              Template
            </label>
            <select id="test-kind" name="kind" className="iv-input" defaultValue={TEST_EMAIL_OPTIONS[0].value}>
              {TEST_EMAIL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="iv-fieldlabel">Recipients</label>
            <RecipientMultiselect options={registrations} />
          </div>
          <div className="iv-actions">
            <ConfirmSubmit
              label="Send test"
              title="Send test email?"
              message="This sends the selected template to every selected recipient using their real registration data. Make sure these are addresses you can check."
              confirmLabel="Send test"
              danger={false}
            />
          </div>
        </form>
      </section>

      {/* ---- Past broadcasts ---- */}
      <section className="iv-card">
        <h2 className="iv-section-title">Past broadcasts</h2>
        {past.length === 0 ? (
          <p className="iv-note">No broadcasts sent yet.</p>
        ) : (
          <div className="iv-tablewrap">
            <table className="iv-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Audience</th>
                  <th>Sent</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {past.map((b) => (
                  <tr key={b.id}>
                    <td>{b.subject}</td>
                    <td style={{ textTransform: "capitalize" }}>{b.segment.replace("_", " ")}</td>
                    <td>{b.sentCount}</td>
                    <td>{b.status}</td>
                    <td>{fmtDate(b.createdAt)}</td>
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

function LifecycleRowView({ row, locale }: { row: MailingRow; locale: string }) {
  const pill =
    row.status === "due" ? "iv-pill--red" : row.status === "done" ? "iv-pill--ok" : "";
  return (
    <tr>
      <td>{row.label}</td>
      <td>{fmtDate(row.sendAt)}</td>
      <td>
        <span className={`iv-pill ${pill}`}>{row.status}</span>
      </td>
      <td>{row.eligible}</td>
      <td>{row.sent}</td>
      <td>
        <form action={sendKindNowAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="kind" value={row.kind} />
          <ConfirmSubmit
            label="Send now"
            title={`Send "${row.label}" now?`}
            message={`Send this email to ${row.eligible} eligible runner(s). Anyone who already received it is skipped.`}
            confirmLabel="Send now"
            danger={false}
          />
        </form>
      </td>
    </tr>
  );
}
