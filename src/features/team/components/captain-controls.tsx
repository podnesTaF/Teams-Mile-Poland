"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  markRosterFinal,
  regenerateCode,
  renameTeam,
} from "@/features/team/actions";

type CaptainControlsProps = {
  teamCode: string;
  teamName: string;
  status: string;
  locale: string;
};

export function CaptainControls({ teamCode, teamName, status, locale }: CaptainControlsProps) {
  const t = useTranslations("team.dashboard.captain");
  const [name, setName] = useState(teamName);

  return (
    <section className="iv-card">
      <span className="iv-eyebrow">{t("eyebrow")}</span>
      <h2 className="iv-title">{t("title")}</h2>

      <form action={renameTeam} className="iv-divider">
        <input type="hidden" name="code" value={teamCode} />
        <input type="hidden" name="locale" value={locale} />
        <label className="block">
          <span className="iv-fieldlabel">{t("renameLabel")}</span>
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="iv-input"
          />
        </label>
        <div className="iv-actions">
          <button type="submit" className="btn btn-stroke btn-sm">
            {t("renameSubmit")}
          </button>
        </div>
      </form>

      <div className="iv-divider grid grid-cols-1 gap-5 sm:grid-cols-2">
        <form action={regenerateCode}>
          <input type="hidden" name="code" value={teamCode} />
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className="btn btn-stroke btn-block">
            {t("regenerateCode")}
          </button>
          <p className="iv-note">{t("regenerateNote")}</p>
        </form>

        <form action={markRosterFinal}>
          <input type="hidden" name="code" value={teamCode} />
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className="btn btn-red btn-block" disabled={status === "final"}>
            {status === "final" ? t("lockedAlready") : t("markFinal")}
          </button>
          <p className="iv-note">{t("markFinalNote")}</p>
        </form>
      </div>
    </section>
  );
}
