"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useRouter } from "@/i18n/navigation";

import { maxDobForMinAge, MIN_PARTICIPANT_AGE, parseDateOnly } from "@/lib/age";

import { updateProfile } from "../actions";
import type { ProfileInput } from "../schemas";

type Props = {
  initial: ProfileInput;
  /** Where to continue after saving (e.g. back to the registration flow). */
  redirectTo?: string;
  /** Reference date (YYYY-MM-DD) for the DOB picker max — e.g. race day during event signup. */
  maxDobAsOf?: string;
};

/**
 * The editable profile card — the design's sectioned dark `.profile-form`
 * (identity aside + registrations live in the page). Fields are unchanged:
 * name, date of birth, sex, club, phone. When reached via `redirectTo` (the
 * finish-profile round-trip) Save returns straight to registration.
 */
export function ProfileForm({ initial, redirectTo, maxDobAsOf }: Props) {
  const t = useTranslations("profile");
  const router = useRouter();
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
    <form onSubmit={onSubmit} className="profile-form">
      {error ? <div className="banner banner--red">{error}</div> : null}
      {saved ? <div className="banner banner--ok">{t("saved")}</div> : null}

      <div className="form-section">
        <div className="form-section__h">{t("sections.detailsTitle")}</div>
        <p className="form-section__sub">{t("sections.detailsSub")}</p>
        <div className="fgrid">
          <Field label={t("fields.firstName")} error={fieldErrors.firstName?.[0]}>
            <input
              className="finput on-dark"
              autoComplete="given-name"
              value={data.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              required
            />
          </Field>
          <Field label={t("fields.lastName")} error={fieldErrors.lastName?.[0]}>
            <input
              className="finput on-dark"
              autoComplete="family-name"
              value={data.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              required
            />
          </Field>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section__h">{t("sections.runnerTitle")}</div>
        <p className="form-section__sub">{t("sections.runnerSub")}</p>
        <div className="fgrid">
          <Field label={t("fields.dateOfBirth")} error={fieldErrors.dateOfBirth?.[0]}>
            <input
              className="finput on-dark"
              type="date"
              value={data.dateOfBirth}
              onChange={(e) => set("dateOfBirth", e.target.value)}
              max={maxDob}
              required
            />
          </Field>
          <Field label={t("fields.sex")} error={fieldErrors.sex?.[0]}>
            <select
              className="fselect on-dark"
              value={data.sex}
              onChange={(e) => set("sex", e.target.value as ProfileInput["sex"])}
              required
            >
              <option value="" disabled>
                {t("fields.sexPlaceholder")}
              </option>
              <option value="M">{t("fields.sexM")}</option>
              <option value="F">{t("fields.sexF")}</option>
            </select>
          </Field>
          <Field label={t("fields.club")} error={fieldErrors.club?.[0]}>
            <input
              className="finput on-dark"
              value={data.club ?? ""}
              onChange={(e) => set("club", e.target.value)}
              placeholder={t("fields.clubPlaceholder")}
            />
          </Field>
          <Field label={t("fields.phone")} error={fieldErrors.phone?.[0]}>
            <input
              className="finput on-dark"
              type="tel"
              autoComplete="tel"
              value={data.phone}
              onChange={(e) => set("phone", e.target.value)}
              required
            />
          </Field>
        </div>
      </div>

      <div className="form-actions">
        <span className="form-actions__note">
          {redirectTo ? t("continueNote") : t("editNote")}
        </span>
        <button type="submit" className="btn btn-red" disabled={pending}>
          {pending ? t("saving") : redirectTo ? t("saveContinue") : t("save")}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flabel on-dark">{label}</span>
      {children}
      {error ? <span className="field-msg">{error}</span> : null}
    </label>
  );
}
