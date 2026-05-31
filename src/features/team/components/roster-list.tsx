"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { ConfirmSubmit } from "@/features/admin/components/confirm-submit";
import { editMember, removeMember } from "@/features/team/actions";

export type RosterEntry = {
  id: string;
  fullName: string;
  email: string;
  paymentStatus: string;
  role: "captain" | "member";
};

type Props = {
  entries: RosterEntry[];
  isCaptain: boolean;
  teamCode: string;
  locale: string;
  emptyCount: number;
};

/**
 * Dashboard roster. Read-only for members; for the captain each row gets an
 * Edit action (opens a modal to change name/email) and members get Remove.
 * This is the single source of the roster — the captain controls no longer
 * repeat it.
 */
export function RosterList({ entries, isCaptain, teamCode, locale, emptyCount }: Props) {
  const t = useTranslations("team.dashboard");
  const [editing, setEditing] = useState<RosterEntry | null>(null);

  return (
    <div className="iv-roster">
      {entries.map((e) => {
        const settled = e.paymentStatus === "paid" || e.paymentStatus === "free";
        return (
          <div key={e.id} className="iv-row">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="iv-row__name">{e.fullName}</span>
                {e.role === "captain" ? (
                  <span className="iv-pill iv-pill--red">{t("captainLabel")}</span>
                ) : null}
              </div>
              <div className="iv-row__email truncate">{e.email}</div>
            </div>

            <div className="iv-inline">
              <span className={cn("iv-pill", settled ? "iv-pill--ok" : "iv-pill--due")}>
                {e.paymentStatus}
              </span>
              {isCaptain ? (
                <>
                  <button type="button" className="iv-linkbtn" onClick={() => setEditing(e)}>
                    {t("captain.edit")}
                  </button>
                  {e.role === "member" ? (
                    <form action={removeMember}>
                      <input type="hidden" name="code" value={teamCode} />
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="runnerId" value={e.id} />
                      <ConfirmSubmit
                        label={t("captain.removeButton")}
                        title={t("captain.removeConfirmTitle")}
                        message={t("captain.removeConfirmMessage", { name: e.fullName })}
                        confirmLabel={t("captain.removeButton")}
                      />
                    </form>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        );
      })}

      {Array.from({ length: emptyCount }).map((_, i) => (
        <div key={`empty-${i}`} className="iv-empty">
          {t("emptySlot")}
        </div>
      ))}

      {editing ? (
        <EditModal
          entry={editing}
          teamCode={teamCode}
          locale={locale}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function EditModal({
  entry,
  teamCode,
  locale,
  onClose,
}: {
  entry: RosterEntry;
  teamCode: string;
  locale: string;
  onClose: () => void;
}) {
  const t = useTranslations("team.dashboard.captain");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("modal-open");
    };
  }, [onClose]);

  return (
    <div
      className="iv-confirm-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="iv-editmodal" role="dialog" aria-modal="true">
        <h3 className="iv-confirm__title">{t("editMemberTitle")}</h3>
        {/* Close optimistically on submit; the server action runs + revalidates. */}
        <form action={editMember} onSubmit={onClose} className="iv-editmodal__form">
          <input type="hidden" name="code" value={teamCode} />
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="runnerId" value={entry.id} />

          <label className="block">
            <span className="iv-fieldlabel">{t("nameLabel")}</span>
            <input name="fullName" defaultValue={entry.fullName} required className="iv-input" />
          </label>

          <label className="block">
            <span className="iv-fieldlabel">{t("emailLabel")}</span>
            <input
              name="email"
              type="email"
              defaultValue={entry.email}
              required
              className="iv-input"
            />
          </label>

          <div className="iv-confirm__actions">
            <button type="button" className="btn btn-stroke btn-sm" onClick={onClose}>
              {t("cancel")}
            </button>
            <button type="submit" className="btn btn-red btn-sm">
              {t("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
