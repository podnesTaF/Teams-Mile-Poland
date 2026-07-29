"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Link } from "@/i18n/navigation";

import { maxDobForMinAge, MIN_PARTICIPANT_AGE, parseDateOnly } from "@/lib/age";

import { registerAsGuest } from "../actions";
import type { GuestRegisterInput } from "../schemas";

type Props = {
  eventSlug: string;
  eventName: string;
  eventDate: string;
  eventDateIso: string;
  eventTime: string | null;
  venue: string;
  locale: string;
};

const EMPTY: GuestRegisterInput = {
  email: "",
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  sex: "" as GuestRegisterInput["sex"],
  club: "",
};

/**
 * Passwordless "register for this race" form for logged-out visitors. Collects
 * the runner details, creates the account + registration in one step, and (via
 * the server action) emails the ticket + a set-password link. Existing emails
 * are pointed at sign-in instead.
 */
export function GuestRegisterForm({ eventSlug, eventName, eventDate, eventDateIso, eventTime, venue, locale }: Props) {
  const t = useTranslations("register");
  const tp = useTranslations("profile");
  const [data, setData] = useState<GuestRegisterInput>(EMPTY);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [sent, setSent] = useState(false);
  const [resent, setResent] = useState(false);
  const [pending, startTransition] = useTransition();

  const dateTime = eventTime ? `${eventDate} · ${eventTime}` : eventDate;
  const signInHref = `/auth/sign-in?redirectTo=${encodeURIComponent(`/events/${eventSlug}/register`)}`;
  const maxDob = maxDobForMinAge(MIN_PARTICIPANT_AGE, parseDateOnly(eventDateIso));

  function set<K extends keyof GuestRegisterInput>(key: K, value: GuestRegisterInput[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  function submit(isResend: boolean) {
    if (pending) return;
    setError(null);
    setShowSignIn(false);
    setFieldErrors({});
    startTransition(async () => {
      const result = await registerAsGuest(eventSlug, data, locale);
      if (!result.ok) {
        if (result.reason === "exists") setShowSignIn(true);
        setError(result.message);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      // No ticket yet — an unverified account + verification email were created.
      // Switch to the "check your email" state (or confirm a re-send).
      if (isResend) setResent(true);
      setSent(true);
    });
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!terms) return;
    submit(false);
  }

  // "Check your email" state — registration completes only after the visitor
  // clicks the verification link (which returns them here with ?verified=1).
  if (sent) {
    return (
      <section className="iv-card center-narrow">
        <span className="iv-eyebrow">{t("checkEmail.title")}</span>
        <p className="iv-sub">{t("checkEmail.body", { email: data.email })}</p>
        {resent ? <div className="banner banner--info">{t("checkEmail.resent")}</div> : null}
        {error ? (
          <div className="banner banner--red">
            {error}
            {showSignIn ? (
              <>
                {" "}
                <Link href={signInHref} className="link">
                  {t("guest.signIn")}
                </Link>
              </>
            ) : null}
          </div>
        ) : null}
        <div className="iv-actions">
          <button
            type="button"
            className="btn btn-stroke-dark"
            onClick={() => submit(true)}
            disabled={pending}
          >
            {pending ? t("checkEmail.resending") : t("checkEmail.resend")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <div>
      <div className="page-head" style={{ marginBottom: 22 }}>
        <span className="iv-eyebrow">{t("confirm.eyebrow")}</span>
        <h1 className="iv-title">{t("guest.title", { event: eventName })}</h1>
        <p className="iv-sub">
          {dateTime} · {venue}
        </p>
      </div>

      <form onSubmit={onSubmit} className="profile-form center-narrow" style={{ maxWidth: 620 }}>
        {error ? (
          <div className="banner banner--red">
            {error}
            {showSignIn ? (
              <>
                {" "}
                <Link href={signInHref} className="link">
                  {t("guest.signIn")}
                </Link>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="form-section">
          <div className="form-section__h">{t("guest.detailsTitle")}</div>
          <p className="form-section__sub">{t("guest.detailsSub")}</p>
          <div className="fgrid">
            <Field label={t("guest.email")} error={fieldErrors.email?.[0]} full>
              <input
                className="finput on-dark"
                type="email"
                autoComplete="email"
                value={data.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="you@email.com"
                required
              />
            </Field>
            <Field label={tp("fields.firstName")} error={fieldErrors.firstName?.[0]}>
              <input
                className="finput on-dark"
                autoComplete="given-name"
                value={data.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                required
              />
            </Field>
            <Field label={tp("fields.lastName")} error={fieldErrors.lastName?.[0]}>
              <input
                className="finput on-dark"
                autoComplete="family-name"
                value={data.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                required
              />
            </Field>
            <Field label={tp("fields.dateOfBirth")} error={fieldErrors.dateOfBirth?.[0]}>
              <input
                className="finput on-dark"
                type="date"
                value={data.dateOfBirth}
                onChange={(e) => set("dateOfBirth", e.target.value)}
                max={maxDob}
                required
              />
            </Field>
            <Field label={tp("fields.sex")} error={fieldErrors.sex?.[0]}>
              <select
                className="fselect on-dark"
                value={data.sex}
                onChange={(e) => set("sex", e.target.value as GuestRegisterInput["sex"])}
                required
              >
                <option value="" disabled>
                  {tp("fields.sexPlaceholder")}
                </option>
                <option value="M">{tp("fields.sexM")}</option>
                <option value="F">{tp("fields.sexF")}</option>
              </select>
            </Field>
            <Field label={tp("fields.club")} error={fieldErrors.club?.[0]} full>
              <input
                className="finput on-dark"
                value={data.club ?? ""}
                onChange={(e) => set("club", e.target.value)}
                placeholder={tp("fields.clubPlaceholder")}
              />
            </Field>
          </div>
        </div>

        <label className="auth-check">
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

        <div className="form-actions">
          <span className="form-actions__note">{t("guest.passwordNote")}</span>
          <button type="submit" className="btn btn-red" disabled={!terms || pending}>
            {pending ? t("submitting") : t("guest.submit")}
          </button>
        </div>

        <p className="auth-foot">
          {t("guest.signInPrompt")}{" "}
          <Link href={signInHref} className="link">
            {t("guest.signIn")}
          </Link>
        </p>
      </form>
    </div>
  );
}

function Field({
  label,
  error,
  full,
  children,
}: {
  label: string;
  error?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={full ? "block col-2" : "block"}>
      <span className="flabel on-dark">{label}</span>
      {children}
      {error ? <span className="field-msg">{error}</span> : null}
    </label>
  );
}
