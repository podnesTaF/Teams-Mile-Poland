import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { requireAdmin } from "@/features/admin/action-helpers";
import { AdminShell } from "@/features/admin/components/admin-shell";
import { ConfirmSubmit } from "@/features/admin/components/confirm-submit";
import { NoDatabaseNotice } from "@/features/admin/components/no-database-notice";
import { RecipientMultiselect } from "@/features/admin/components/recipient-multiselect";
import { formatAdminDateTime as fmtDate } from "@/features/admin/format";
import {
  runDueMailingsAction,
  sendBroadcastAction,
  sendKindNowAction,
  sendTestEmailAction,
} from "@/features/mailings/actions";
import { getMailingsOverview, listRegistrations, type MailingRow } from "@/features/mailings/data";
import { TEST_EMAIL_OPTIONS } from "@/features/mailings/test-send";
import {
  runDueEventMailingsAction,
  sendEventKindNowAction,
} from "@/features/event-mailings/actions";
import {
  getEventMailingsOverview,
  type EventMailingRow,
  type EventMailingsGroup,
} from "@/features/event-mailings/data";
import {
  resendUserBroadcastAction,
  sendUserBroadcastAction,
} from "@/features/event-mailings/user-broadcast-actions";
import { listUserBroadcasts, type UserBroadcastRow } from "@/features/event-mailings/user-broadcast";
import { describeUserSegments, type SegmentOption } from "@/features/event-mailings/user-segments";

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
  await requireAdmin(locale);

  return (
    <AdminShell title="Mailings" active="mailings">
      {msg ? <div className="iv-notice iv-notice--info">{msg}</div> : null}

      {process.env.DATABASE_URL ? (
        <MailingsBody locale={locale} />
      ) : (
        <NoDatabaseNotice>manage mailings</NoDatabaseNotice>
      )}
    </AdminShell>
  );
}

async function MailingsBody({ locale }: { locale: string }) {
  const now = new Date();
  const { rows, past, totalRunners } = await getMailingsOverview(now);
  const eventGroups = await getEventMailingsOverview(now);
  const registrations = await listRegistrations();
  const userSegments = await describeUserSegments();
  const userBroadcasts = await listUserBroadcasts();

  return (
    <>
      {/* ---- Series event lifecycle (per event) ---- */}
      <section className="iv-card" style={{ marginTop: 20 }}>
        <div className="iv-toolbar" style={{ marginBottom: 12 }}>
          <h2 className="iv-section-title">Series lifecycle (per event)</h2>
          <form action={runDueEventMailingsAction}>
            <input type="hidden" name="locale" value={locale} />
            <ConfirmSubmit
              label="Run due series mailings"
              title="Run due series mailings?"
              message="Send every due lifecycle email across the individual mile series. Each event has its own chain. Already-sent emails are skipped. Reminder emails include the confirmation ask only for runners still awaiting confirmation."
              confirmLabel="Run now"
              danger={false}
            />
          </form>
        </div>
        <p className="iv-note" style={{ marginBottom: 14 }}>
          One chain per mile night. Reminders (−7 / −3 / −1) ask unconfirmed runners to confirm
          participation; confirmed runners still get the reminder body without the ask. Cron:{" "}
          <code>/api/cron/mailings</code>.
        </p>
        {eventGroups.length === 0 ? (
          <p className="iv-note">No active series events.</p>
        ) : (
          eventGroups.map((g) => (
            <EventLifecycleGroupView key={g.eventSlug} group={g} locale={locale} />
          ))
        )}
      </section>

      {/* ---- User broadcast composer (segments + unsubscribe) ---- */}
      <UserBroadcastSection locale={locale} segments={userSegments} past={userBroadcasts} />

      {/* ---- Legacy lifecycle (frozen warsaw-2026) ---- */}
      <section className="iv-card">
        <div className="iv-toolbar" style={{ marginBottom: 12 }}>
          <h2 className="iv-section-title">Legacy lifecycle (warsaw-2026)</h2>
          <form action={runDueMailingsAction}>
            <input type="hidden" name="locale" value={locale} />
            <ConfirmSubmit
              label="Run due legacy mailings"
              title="Run due legacy mailings?"
              message={`Send every lifecycle email that is currently due to eligible legacy runners (${totalRunners} registered). Already-sent emails are skipped.`}
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
          Frozen team-event chain. Does not email series participants.
        </p>
      </section>

      {/* ---- Legacy broadcast composer ---- */}
      <section className="iv-card">
        <h2 className="iv-section-title">Send a legacy broadcast</h2>
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

function UserBroadcastSection({
  locale,
  segments,
  past,
}: {
  locale: string;
  segments: SegmentOption[];
  past: UserBroadcastRow[];
}) {
  return (
    <>
      <section className="iv-card">
        <h2 className="iv-section-title">Send a user broadcast</h2>
        <p className="iv-note" style={{ marginTop: 4 }}>
          Emails a segment of user accounts (not the frozen legacy runners). Each series event has
          its own <em>all registrations</em>, <em>awaiting confirmation</em>, and{" "}
          <em>confirmed</em> segments — use awaiting confirmation to nudge participation confirms.
          Opted-out users are excluded automatically; every broadcast carries an unsubscribe footer.
          Recipient counts are live. Sends are deduped per person.
        </p>
        <form action={sendUserBroadcastAction} className="iv-editmodal__form" style={{ marginTop: 14 }}>
          <input type="hidden" name="locale" value={locale} />
          <div>
            <label className="iv-fieldlabel" htmlFor="ub-subject">
              Subject
            </label>
            <input id="ub-subject" name="subject" className="iv-input" required maxLength={160} />
          </div>
          <div>
            <label className="iv-fieldlabel" htmlFor="ub-segment">
              Segment
            </label>
            <select id="ub-segment" name="segment" className="iv-input" defaultValue="all">
              {segments.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label} ({s.count})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="iv-fieldlabel" htmlFor="ub-body">
              Message (HTML allowed)
            </label>
            <textarea
              id="ub-body"
              name="body"
              required
              rows={8}
              className="iv-input"
              style={{ height: "auto", padding: "12px 14px", lineHeight: 1.5 }}
            />
          </div>
          <div className="iv-actions">
            <ConfirmSubmit
              label="Send user broadcast"
              title="Send user broadcast?"
              message="This emails the selected user segment immediately (opted-out users excluded). Double-check the subject and message."
              confirmLabel="Send user broadcast"
              danger={false}
            />
          </div>
        </form>
      </section>

      <section className="iv-card">
        <h2 className="iv-section-title">Past user broadcasts</h2>
        {past.length === 0 ? (
          <p className="iv-note">No user broadcasts sent yet.</p>
        ) : (
          <div className="iv-tablewrap">
            <table className="iv-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Segment</th>
                  <th>Sent</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {past.map((b) => (
                  <tr key={b.id}>
                    <td>{b.subject}</td>
                    <td>{b.segment}</td>
                    <td>{b.sentCount}</td>
                    <td>{b.status}</td>
                    <td>{fmtDate(b.createdAt)}</td>
                    <td>
                      <form action={resendUserBroadcastAction}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="broadcastId" value={b.id} />
                        <ConfirmSubmit
                          label="Re-send"
                          title="Re-send this broadcast?"
                          message="Re-sends to the same segment. Anyone already emailed for this broadcast is skipped, so nobody is double-emailed."
                          confirmLabel="Re-send"
                          danger={false}
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

function EventLifecycleGroupView({
  group,
  locale,
}: {
  group: EventMailingsGroup;
  locale: string;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="iv-toolbar" style={{ marginBottom: 8 }}>
        <h3 className="iv-section-title" style={{ fontSize: 16, margin: 0 }}>
          {group.eventLabel}
        </h3>
        <p className="iv-note" style={{ margin: 0 }}>
          {group.eligible} eligible · {group.awaitingConfirmation} awaiting confirmation
        </p>
      </div>
      <div className="iv-tablewrap">
        <table className="iv-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Scheduled</th>
              <th>Status</th>
              <th>Eligible</th>
              <th>Awaiting confirm</th>
              <th>Sent</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((r) => (
              <EventLifecycleRowView key={`${r.eventSlug}:${r.kind}`} row={r} locale={locale} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EventLifecycleRowView({ row, locale }: { row: EventMailingRow; locale: string }) {
  const pill =
    row.status === "due" ? "iv-pill--red" : row.status === "done" ? "iv-pill--ok" : "";
  const confirmNote =
    row.kind === "morning"
      ? "No confirm ask on morning-of."
      : `Confirm ask shown to ${row.awaitingConfirmation} awaiting confirmation (of ${row.eligible} eligible).`;
  return (
    <tr>
      <td>{row.label}</td>
      <td>{fmtDate(row.sendAt)}</td>
      <td>
        <span className={`iv-pill ${pill}`}>{row.status}</span>
      </td>
      <td>{row.eligible}</td>
      <td>{row.kind === "morning" ? "—" : row.awaitingConfirmation}</td>
      <td>{row.sent}</td>
      <td>
        <form action={sendEventKindNowAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="eventSlug" value={row.eventSlug} />
          <input type="hidden" name="kind" value={row.kind} />
          <ConfirmSubmit
            label="Send now"
            title={`Send "${row.label}" for ${row.eventLabel}?`}
            message={`Send this email to ${row.eligible} eligible runner(s) for ${row.eventLabel}. ${confirmNote} Anyone who already received it is skipped.`}
            confirmLabel="Send now"
            danger={false}
          />
        </form>
      </td>
    </tr>
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
