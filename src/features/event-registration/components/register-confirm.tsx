"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Link, useRouter } from "@/i18n/navigation";

import { registerForEvent } from "../actions";

type Props = {
  eventSlug: string;
  eventName: string;
  eventDate: string;
  eventTime: string | null;
  venue: string;
  runnerName: string;
  runnerEmail: string;
};

/**
 * Auth-gated confirm step (design `f-register`): a white commit-list summary +
 * a terms/confirm aside. Registration is free, so success routes straight to
 * the ticket. Guard failures (verify/profile) route to the right fix.
 */
export function RegisterConfirm({
  eventSlug,
  eventName,
  eventDate,
  eventTime,
  venue,
  runnerName,
  runnerEmail,
}: Props) {
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

  const dateTime = eventTime ? `${eventDate} · ${eventTime}` : eventDate;

  return (
    <form onSubmit={onSubmit}>
      <div className="page-head" style={{ marginBottom: 22 }}>
        <span className="iv-eyebrow">{t("confirm.eyebrow")}</span>
        <h1 className="iv-title">{t("confirm.title")}</h1>
        <p className="iv-sub">{t("confirm.subtitle")}</p>
      </div>

      <div className="detail-grid">
        <div className="card-white" style={{ padding: "clamp(24px, 3vw, 36px)" }}>
          <div className="commit-list">
            <Row k={t("confirm.race")} v={eventName} />
            <Row k={t("confirm.dateTime")} v={dateTime} />
            <Row k={t("confirm.venue")} v={venue} />
            <Row k={t("confirm.distance")} v={t("confirm.distanceValue")} sub={t("confirm.distanceSub")} />
            <Row k={t("confirm.runner")} v={runnerName} sub={runnerEmail} />
            <Row k={t("confirm.cost")} v={t("summary.free")} priceTag />
          </div>
        </div>

        <aside>
          <div className="slots-card">
            {error ? <div className="banner banner--red">{error}</div> : null}
            <label className="auth-check" style={{ color: "var(--ink)" }}>
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
            <button type="submit" className="btn btn-red btn-block" disabled={!terms || pending}>
              {pending ? t("submitting") : t("confirm.submit")}
            </button>
            <p className="slots-note">{t("confirm.note")}</p>
          </div>
        </aside>
      </div>
    </form>
  );
}

function Row({
  k,
  v,
  sub,
  priceTag,
}: {
  k: string;
  v: string;
  sub?: string;
  priceTag?: boolean;
}) {
  return (
    <div className="commit-row">
      <span className="commit-k">{k}</span>
      <span className={priceTag ? "commit-v price-tag" : "commit-v"}>
        {v}
        {sub ? <small>{sub}</small> : null}
      </span>
    </div>
  );
}
