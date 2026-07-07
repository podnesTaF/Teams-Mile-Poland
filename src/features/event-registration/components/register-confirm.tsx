"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

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
 *
 * When reached with `?verified=1` (a guest returning from the verification
 * link, now auto-signed-in), it **auto-submits on mount** — no extra click —
 * reusing the same `registerForEvent` path that records `terms=true` and fires
 * the confirmation ticket email. Manual signed-in visits show the confirm form.
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
  const autoConfirm = useSearchParams().get("verified") === "1";
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fired = useRef(false);

  function run() {
    if (pending) return;
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

  // Auto-complete for a returning verified guest (terms already accepted on the
  // guest form). Fire once; a StrictMode double-mount is guarded by the ref.
  useEffect(() => {
    if (autoConfirm && !fired.current) {
      fired.current = true;
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConfirm]);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!terms) return;
    run();
  }

  const dateTime = eventTime ? `${eventDate} · ${eventTime}` : eventDate;

  // Returning verified guest: show a finishing state while we auto-register.
  // If the auto-submit fails (e.g. a transient error), offer a retry rather
  // than dead-ending on a static message.
  if (autoConfirm) {
    return (
      <section className="iv-card center-narrow">
        <span className="iv-eyebrow">{t("confirm.eyebrow")}</span>
        <p className="iv-sub">{error ?? t("confirm.finishing")}</p>
        {error ? (
          <div className="iv-actions">
            <button type="button" className="btn btn-red" onClick={run} disabled={pending}>
              {pending ? t("submitting") : t("confirm.submit")}
            </button>
          </div>
        ) : null}
      </section>
    );
  }

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
