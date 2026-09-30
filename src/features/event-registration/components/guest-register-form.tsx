"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Link } from "@/i18n/navigation";

import { PhoneField } from "@/components/ui/phone-field";
import { maxDobForMinAge, MIN_PARTICIPANT_AGE, parseDateOnly } from "@/lib/age";
import { useValidationMessage } from "@/lib/validation-messages";

import { type GuestRegisterResult, registerAsGuest } from "../actions";
import { type GuestRegisterInput, guestRegisterSchema } from "../schemas";
import { RegisterSummary } from "./register-summary";

type Props = {
  eventSlug: string;
  eventName: string;
  eventDate: string;
  eventDateIso: string;
  eventTime: string | null;
  venue: string;
  locale: string;
  /** Card price in whole PLN (ADR 0015); `0` = not card-paid. */
  pricePln: number;
  /** ACER fee in whole ACER (ADR 0013); `0` = free. Never both with `pricePln`. */
  feeAcer: number;
};

const EMPTY: GuestRegisterInput = {
  email: "",
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  sex: "" as GuestRegisterInput["sex"],
  club: "",
  phone: "",
};

type FieldErrors = Partial<Record<keyof GuestRegisterInput, string>>;

/** First message per field, from a zod failure or the action's `fieldErrors`. */
function firstErrors(errors: Record<string, string[]> | undefined): FieldErrors {
  const out: FieldErrors = {};
  for (const [key, messages] of Object.entries(errors ?? {})) {
    if (messages?.[0]) out[key as keyof GuestRegisterInput] = messages[0];
  }
  return out;
}

/**
 * Passwordless "register for this race" form for logged-out visitors. Collects
 * the runner details and creates an **unverified** account; the server action
 * mails a verification link whose callback returns here, signed in, at the
 * confirm step. Existing verified emails are pointed at sign-in instead.
 *
 * It captures **no consent** (ADR 0006): the documents and the image question
 * live at the confirm step, so acceptance and the registration it covers are one
 * atomic act rather than a box ticked days earlier against a document nobody was
 * shown.
 *
 * Validation runs **here first**, with the same zod schema the action uses, and
 * every message is translated through `useValidationMessage`. The form is
 * `noValidate` on purpose: the browser's own `required` bubbles were the only
 * validation most fields ever showed, in the browser's language and gone on the
 * next click, while the phone field — which had none — went to the server and
 * came back in English. Now every field fails the same way, inline and red.
 */
export function GuestRegisterForm({
  eventSlug,
  eventName,
  eventDate,
  eventDateIso,
  eventTime,
  venue,
  locale,
  pricePln,
  feeAcer,
}: Props) {
  const t = useTranslations("register");
  const tp = useTranslations("profile");
  const message = useValidationMessage();
  const [data, setData] = useState<GuestRegisterInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [sent, setSent] = useState(false);
  const [resent, setResent] = useState(false);
  const [pending, startTransition] = useTransition();

  const dateTime = eventTime ? `${eventDate} · ${eventTime}` : eventDate;
  const signInHref = `/auth/sign-in?redirectTo=${encodeURIComponent(`/events/${eventSlug}/register`)}`;
  const maxDob = maxDobForMinAge(MIN_PARTICIPANT_AGE, parseDateOnly(eventDateIso));

  function set<K extends keyof GuestRegisterInput>(key: K, value: GuestRegisterInput[K]) {
    setData((d) => ({ ...d, [key]: value }));
    if (fieldErrors[key]) setFieldErrors((e) => ({ ...e, [key]: undefined }));
  }

  /** The banner for a refusal, in the runner's language — never `result.message`. */
  function bannerFor(result: Extract<GuestRegisterResult, { ok: false }>): string {
    switch (result.reason) {
      case "invalid":
        return t("errors.invalid");
      case "exists":
        return t("errors.exists");
      case "closed":
        return t("lifecycle.closedBody");
      case "notfound":
        return t("errors.notfound");
      case "age":
        return t("ageBody");
      default:
        return t("errors.failed");
    }
  }

  function submit(isResend: boolean) {
    if (pending) return;
    setError(null);
    setShowSignIn(false);
    setFieldErrors({});

    // Same schema as the action: nothing the server would refuse leaves the
    // browser, and the runner sees every problem at once, in their language.
    const checked = guestRegisterSchema.safeParse(data);
    if (!checked.success) {
      setFieldErrors(firstErrors(checked.error.flatten().fieldErrors as Record<string, string[]>));
      setError(t("errors.invalid"));
      return;
    }

    startTransition(async () => {
      const result = await registerAsGuest(eventSlug, data, locale);
      if (!result.ok) {
        if (result.reason === "exists") setShowSignIn(true);
        setError(bannerFor(result));
        setFieldErrors(firstErrors(result.fieldErrors));
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
    submit(false);
  }

  const banner = error ? (
    <div className="banner banner--red" role="alert">
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
  ) : null;

  // "Check your email" state — no registration exists until the visitor clicks
  // the verification link, which returns them to this same page, now signed in,
  // at the confirm step where the documents are.
  if (sent) {
    return (
      <section className="card-white rp-state" data-register-state="check-email">
        <span className="iv-eyebrow">{t("guest.eyebrow")}</span>
        <h1 className="rp-state__title">{t("checkEmail.title")}</h1>
        <p className="iv-sub">{t("checkEmail.body", { email: data.email })}</p>
        {resent ? <div className="banner banner--info">{t("checkEmail.resent")}</div> : null}
        {banner}
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

  const cardPaid = pricePln > 0;
  const paid = feeAcer > 0;
  const price = (
    <strong
      className={cardPaid || paid ? "rp-price" : "rp-price rp-price--free"}
      data-entry-price-notice={cardPaid ? pricePln : undefined}
      data-entry-fee-notice={paid ? feeAcer : undefined}
    >
      {cardPaid
        ? t("payment.amount", { price: pricePln })
        : paid
          ? t("fee.amount", { amount: feeAcer })
          : t("summary.free")}
    </strong>
  );

  return (
    <div className="rp">
      <header className="page-head rp-head">
        <span className="iv-eyebrow">{t("guest.eyebrow")}</span>
        <h1 className="iv-title">{t("guest.title", { event: eventName })}</h1>
        <p className="iv-sub">{t("guest.detailsSub")}</p>
      </header>

      <form onSubmit={onSubmit} noValidate className="detail-grid rp-grid">
        <div className="card-white rp-card">
          {banner}
          <div className="rp-section__h">{t("guest.detailsTitle")}</div>
          <div className="fgrid">
            <Field label={t("guest.email")} error={message(fieldErrors.email)} full>
              <input
                className={fieldErrors.email ? "finput finput--err" : "finput"}
                type="email"
                autoComplete="email"
                inputMode="email"
                value={data.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="you@email.com"
              />
            </Field>
            <Field label={tp("fields.firstName")} error={message(fieldErrors.firstName)}>
              <input
                className={fieldErrors.firstName ? "finput finput--err" : "finput"}
                autoComplete="given-name"
                value={data.firstName}
                onChange={(e) => set("firstName", e.target.value)}
              />
            </Field>
            <Field label={tp("fields.lastName")} error={message(fieldErrors.lastName)}>
              <input
                className={fieldErrors.lastName ? "finput finput--err" : "finput"}
                autoComplete="family-name"
                value={data.lastName}
                onChange={(e) => set("lastName", e.target.value)}
              />
            </Field>
            <Field
              label={tp("fields.dateOfBirth")}
              error={message(fieldErrors.dateOfBirth)}
              hint={fieldErrors.dateOfBirth ? undefined : t("ageBody")}
            >
              <input
                className={fieldErrors.dateOfBirth ? "finput finput--err" : "finput"}
                type="date"
                value={data.dateOfBirth}
                onChange={(e) => set("dateOfBirth", e.target.value)}
                max={maxDob}
              />
            </Field>
            <Field label={tp("fields.sex")} error={message(fieldErrors.sex)}>
              <select
                className={fieldErrors.sex ? "fselect finput--err" : "fselect"}
                value={data.sex}
                onChange={(e) => set("sex", e.target.value as GuestRegisterInput["sex"])}
              >
                <option value="" disabled>
                  {tp("fields.sexPlaceholder")}
                </option>
                <option value="M">{tp("fields.sexM")}</option>
                <option value="F">{tp("fields.sexF")}</option>
              </select>
            </Field>
            {/* PhoneField renders its own <label> root — no Field wrapper. */}
            <div className="col-2 block">
              <span className="flabel">{tp("fields.phone")}</span>
              <PhoneField
                variant="light"
                value={data.phone}
                onChange={(value) => set("phone", value)}
                error={message(fieldErrors.phone)}
              />
            </div>
            <Field
              label={tp("fields.club")}
              error={message(fieldErrors.club)}
              hint={tp("fields.clubPlaceholder")}
              full
            >
              <input
                className={fieldErrors.club ? "finput finput--err" : "finput"}
                value={data.club ?? ""}
                onChange={(e) => set("club", e.target.value)}
              />
            </Field>
          </div>
        </div>

        <RegisterSummary eventName={eventName} dateTime={dateTime} venue={venue} price={price}>
          <button type="submit" className="btn btn-red btn-block" disabled={pending}>
            {pending ? t("submitting") : t("guest.submit")}
          </button>
          <p className="slots-note">{t("guest.passwordNote")}</p>
          {cardPaid ? <p className="slots-note">{t("payment.guestNote")}</p> : null}
          <p className="slots-note">{t("guest.consentNote")}</p>
          <p className="slots-note rp-foot">
            {t("guest.signInPrompt")}{" "}
            <Link href={signInHref} className="link">
              {t("guest.signIn")}
            </Link>
          </p>
        </RegisterSummary>
      </form>
    </div>
  );
}

function Field({
  label,
  error,
  hint,
  full,
  children,
}: {
  label: string;
  error?: string;
  /** Neutral explanatory text shown when there is no error to display instead. */
  hint?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={full ? "col-2 block" : "block"}>
      <span className="flabel">{label}</span>
      {children}
      {error ? (
        <span className="field-msg">{error}</span>
      ) : hint ? (
        <span className="fhint">{hint}</span>
      ) : null}
    </label>
  );
}
