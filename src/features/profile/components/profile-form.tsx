"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useRouter } from "@/i18n/navigation";

import { PhoneField } from "@/components/ui/phone-field";
import { maxDobForMinAge, MIN_PARTICIPANT_AGE, parseDateOnly } from "@/lib/age";
import { useValidationMessage } from "@/lib/validation-messages";

import { updateProfile } from "../actions";
import { type ProfileInput, profileSchema } from "../schemas";

type Props = {
  initial: ProfileInput;
  /** Where to continue after saving (e.g. back to the registration flow). */
  redirectTo?: string;
  /** Reference date (YYYY-MM-DD) for the DOB picker max — e.g. race day during event signup. */
  maxDobAsOf?: string;
  /**
   * "dark" (default) is the profile page's own card. "light" is the same form
   * on white — the complete-your-profile step of the event register page, which
   * sits in the register page's white card next to the same-styled guest form.
   */
  variant?: "dark" | "light";
};

/**
 * The editable profile card — the design's sectioned `.profile-form` (identity
 * aside + registrations live in the page). Fields are unchanged: name, date of
 * birth, sex, club, phone. When reached via `redirectTo` (the finish-profile
 * round-trip) Save returns straight to registration.
 *
 * Validates with the action's own `profileSchema` before submitting and shows
 * every message translated (`useValidationMessage`); `noValidate` keeps the
 * browser's bubbles out of it, as on the guest register form.
 */
export function ProfileForm({ initial, redirectTo, maxDobAsOf, variant = "dark" }: Props) {
  const t = useTranslations("profile");
  const light = variant === "light";
  const input = light ? "finput" : "finput on-dark";
  const select = light ? "fselect" : "fselect on-dark";
  const label = light ? "flabel" : "flabel on-dark";
  const router = useRouter();
  const message = useValidationMessage();
  const [data, setData] = useState<ProfileInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

  const maxDob = maxDobForMinAge(
    MIN_PARTICIPANT_AGE,
    maxDobAsOf ? parseDateOnly(maxDobAsOf) : new Date(),
  );

  function set<K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) {
    setData((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setFieldErrors({});
    const checked = profileSchema.safeParse(data);
    if (!checked.success) {
      setFieldErrors(checked.error.flatten().fieldErrors as Record<string, string[]>);
      setError(t("checkFields"));
      return;
    }
    startTransition(async () => {
      const result = await updateProfile(data);
      if (!result.ok) {
        setError(result.message);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      // Continue the registration round-trip when we came from it.
      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={light ? "profile-form profile-form--light" : "profile-form"}
    >
      {error ? <div className="banner banner--red">{error}</div> : null}
      {saved ? <div className="banner banner--ok">{t("saved")}</div> : null}

      <div className="form-section">
        <div className="form-section__h">{t("sections.detailsTitle")}</div>
        <p className="form-section__sub">{t("sections.detailsSub")}</p>
        <div className="fgrid">
          <Field
            label={t("fields.firstName")}
            labelClass={label}
            error={message(fieldErrors.firstName?.[0])}
          >
            <input
              className={input}
              autoComplete="given-name"
              value={data.firstName}
              onChange={(e) => set("firstName", e.target.value)}
            />
          </Field>
          <Field
            label={t("fields.lastName")}
            labelClass={label}
            error={message(fieldErrors.lastName?.[0])}
          >
            <input
              className={input}
              autoComplete="family-name"
              value={data.lastName}
              onChange={(e) => set("lastName", e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section__h">{t("sections.runnerTitle")}</div>
        <p className="form-section__sub">{t("sections.runnerSub")}</p>
        <div className="fgrid">
          <Field
            label={t("fields.dateOfBirth")}
            labelClass={label}
            error={message(fieldErrors.dateOfBirth?.[0])}
          >
            <input
              className={input}
              type="date"
              value={data.dateOfBirth}
              onChange={(e) => set("dateOfBirth", e.target.value)}
              max={maxDob}
            />
          </Field>
          <Field label={t("fields.sex")} labelClass={label} error={message(fieldErrors.sex?.[0])}>
            <select
              className={select}
              value={data.sex}
              onChange={(e) => set("sex", e.target.value as ProfileInput["sex"])}
            >
              <option value="" disabled>
                {t("fields.sexPlaceholder")}
              </option>
              <option value="M">{t("fields.sexM")}</option>
              <option value="F">{t("fields.sexF")}</option>
            </select>
          </Field>
          <Field label={t("fields.club")} labelClass={label} error={message(fieldErrors.club?.[0])}>
            <input
              className={input}
              value={data.club ?? ""}
              onChange={(e) => set("club", e.target.value)}
              placeholder={t("fields.clubPlaceholder")}
            />
          </Field>
          {/* PhoneField renders its own <label> root — no Field wrapper. */}
          <div className="block">
            <span className={label}>{t("fields.phone")}</span>
            <PhoneField
              variant={variant}
              value={data.phone}
              onChange={(value) => set("phone", value)}
              error={message(fieldErrors.phone?.[0])}
            />
          </div>
        </div>
      </div>

      <div className="form-actions">
        <span className="form-actions__note">{redirectTo ? t("continueNote") : t("editNote")}</span>
        <button type="submit" className="btn btn-red" disabled={pending}>
          {pending ? t("saving") : redirectTo ? t("saveContinue") : t("save")}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  labelClass,
  error,
  children,
}: {
  label: string;
  labelClass: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
      {error ? <span className="field-msg">{error}</span> : null}
    </label>
  );
}
