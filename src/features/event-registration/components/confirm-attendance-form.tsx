import { getTranslations } from "next-intl/server";

import { confirmAttendance } from "../confirm-actions";

/**
 * The confirm-attendance CTA, shared by the profile registration card and the
 * signed ticket page so both call the one action (PRD #26).
 *
 * A plain server-action `<form>`, deliberately not a client island: the ticket
 * page is reachable by a signed-out guest, and confirmation must survive with
 * no JavaScript. It is a POST rather than a link because email security
 * scanners follow links in transit — a GET confirm URL would silently mark
 * whole inboxes as attending.
 */
export async function ConfirmAttendanceForm({
  registrationId,
  locale,
  surface,
  sig,
  buttonClassName = "btn btn-red btn-sm",
}: {
  registrationId: string;
  locale: string;
  surface: "profile" | "ticket";
  /** Ticket signature — lets a signed-out guest confirm from the ticket page. */
  sig?: string;
  buttonClassName?: string;
}) {
  const t = await getTranslations("profile.registrations.confirm");

  return (
    <form action={confirmAttendance} style={{ display: "inline" }}>
      <input type="hidden" name="registrationId" value={registrationId} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="surface" value={surface} />
      {sig ? <input type="hidden" name="sig" value={sig} /> : null}
      <button type="submit" className={buttonClassName}>
        {t("cta")}
      </button>
    </form>
  );
}

/** Outcomes the action reports back through `?c=`. */
const NOTICE_KEYS = {
  confirmed: { key: "ok", ok: true },
  already: { key: "already", ok: true },
  ineligible: { key: "ineligible", ok: false },
  notfound: { key: "failed", ok: false },
  denied: { key: "failed", ok: false },
} as const;

export type ConfirmNotice = { key: string; ok: boolean };

/** Map a `?c=` value to a translation key under `profile.registrations.confirm`. */
export function confirmNotice(value: string | undefined): ConfirmNotice | null {
  if (!value) return null;
  return NOTICE_KEYS[value as keyof typeof NOTICE_KEYS] ?? null;
}
