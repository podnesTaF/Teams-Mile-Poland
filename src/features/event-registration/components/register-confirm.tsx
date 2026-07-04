"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Link, useRouter } from "@/i18n/navigation";

import { registerForEvent } from "../actions";

type Props = {
  eventSlug: string;
  eventDate: string;
  eventTime: string | null;
  venue: string;
};

/**
 * Auth-gated confirm step: shows the summary + terms, then calls the server
 * action. Registration is free, so success routes straight to the ticket.
 * Guard failures (verify/profile) route to the right fix.
 */
export function RegisterConfirm({ eventSlug, eventDate, eventTime, venue }: Props) {
  const t = useTranslations("register");
  const router = useRouter();
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!terms || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await registerForEvent(eventSlug);
      if (!result.ok) {
        if (result.reason === "profile") {
          router.push(`/profile?redirectTo=/events/${eventSlug}/register`);
          return;
        }
        if (result.reason === "verify") {
          router.push("/auth/verify-email");
          return;
        }
        setError(result.message);
        return;
      }
      // Absolute, signed ticket URL — assign directly.
      window.location.assign(result.ticketUrl);
    });
  }

  return (
    <form onSubmit={onSubmit} className="iv-card">
      <span className="iv-eyebrow">{t("eyebrow")}</span>
      <h1 className="iv-title">{t("title")}</h1>

      <div className="iv-grid" style={{ marginTop: 18 }}>
        <Summary label={t("summary.date")} value={eventTime ? `${eventDate} · ${eventTime}` : eventDate} />
        <Summary label={t("summary.venue")} value={venue} />
        <Summary label={t("summary.price")} value={t("summary.free")} />
      </div>

      {error ? <div className="iv-notice iv-notice--error" style={{ marginTop: 16 }}>{error}</div> : null}

      <label className="auth-check" style={{ marginTop: 18 }}>
        <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
        <span>
          {t.rich("terms", {
            link: (chunks) => (
              <Link href="/terms" target="_blank" rel="noopener noreferrer">
                {chunks}
              </Link>
            ),
          })}
        </span>
      </label>

      <div className="iv-actions">
        <button type="submit" className="btn btn-red btn-block" disabled={!terms || pending}>
          {pending ? t("submitting") : t("submitFree")}
        </button>
      </div>
    </form>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="tk-field">
      <div className="tk-field__label">{label}</div>
      <div className="tk-field__value">{value}</div>
    </div>
  );
}
