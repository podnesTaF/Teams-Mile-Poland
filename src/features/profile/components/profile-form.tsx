"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useRouter } from "@/i18n/navigation";

import { updateProfile } from "../actions";
import type { ProfileInput } from "../schemas";

type Props = {
  initial: ProfileInput;
  /** When true, show the "complete your profile to register" prompt. */
  incomplete?: boolean;
};

export function ProfileForm({ initial, incomplete }: Props) {
  const t = useTranslations("profile");
  const router = useRouter();
  const [data, setData] = useState<ProfileInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

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
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="iv-card">
      <span className="iv-eyebrow">{t("eyebrow")}</span>
      <h1 className="iv-title">{t("title")}</h1>
      <p className="iv-sub">{t("subtitle")}</p>

      {incomplete ? <div className="iv-notice iv-notice--info">{t("completePrompt")}</div> : null}
      {error ? <div className="iv-notice iv-notice--error">{error}</div> : null}
      {saved ? <div className="iv-notice iv-notice--info">{t("saved")}</div> : null}

      <div className="iv-grid" style={{ marginTop: 20 }}>
        <Field label={t("fields.firstName")} error={fieldErrors.firstName?.[0]}>
          <input
            className="iv-input"
            autoComplete="given-name"
            value={data.firstName}
            onChange={(e) => set("firstName", e.target.value)}
            required
          />
        </Field>
        <Field label={t("fields.lastName")} error={fieldErrors.lastName?.[0]}>
          <input
            className="iv-input"
            autoComplete="family-name"
            value={data.lastName}
            onChange={(e) => set("lastName", e.target.value)}
            required
          />
        </Field>
      </div>

      <div className="iv-grid" style={{ marginTop: 14 }}>
        <Field label={t("fields.dateOfBirth")} error={fieldErrors.dateOfBirth?.[0]}>
          <input
            className="iv-input"
            type="date"
            value={data.dateOfBirth}
            onChange={(e) => set("dateOfBirth", e.target.value)}
            required
          />
        </Field>
        <Field label={t("fields.sex")} error={fieldErrors.sex?.[0]}>
          <select
            className="iv-input"
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
      </div>

      <div className="iv-grid" style={{ marginTop: 14 }}>
        <Field label={t("fields.club")} error={fieldErrors.club?.[0]}>
          <input
            className="iv-input"
            value={data.club ?? ""}
            onChange={(e) => set("club", e.target.value)}
            placeholder={t("fields.clubPlaceholder")}
          />
        </Field>
        <Field label={t("fields.phone")} error={fieldErrors.phone?.[0]}>
          <input
            className="iv-input"
            type="tel"
            autoComplete="tel"
            value={data.phone}
            onChange={(e) => set("phone", e.target.value)}
            required
          />
        </Field>
      </div>

      <div className="iv-actions">
        <button type="submit" className="btn btn-red" disabled={pending}>
          {pending ? t("saving") : t("save")}
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
      <span className="iv-fieldlabel">{label}</span>
      {children}
      {error ? <span className="ff-error-msg">{error}</span> : null}
    </label>
  );
}
