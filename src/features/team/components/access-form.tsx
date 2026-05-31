"use client";

import { useTranslations } from "next-intl";

import { requestAccess } from "@/features/team/actions";

type AccessFormProps = {
  code: string;
  locale: string;
};

export function AccessForm({ code, locale }: AccessFormProps) {
  const t = useTranslations("team.access");

  return (
    <form action={requestAccess} className="iv-card">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="locale" value={locale} />

      <span className="iv-eyebrow">{t("eyebrow")}</span>
      <h1 className="iv-title">{t("title")}</h1>
      <p className="iv-sub">{t("description", { code })}</p>

      <label className="block" style={{ marginTop: 24 }}>
        <span className="iv-fieldlabel">{t("emailLabel")}</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="iv-input"
        />
      </label>

      <div className="iv-actions">
        <button type="submit" className="btn btn-red">
          {t("submit")}
          <span aria-hidden>→</span>
        </button>
      </div>
    </form>
  );
}
