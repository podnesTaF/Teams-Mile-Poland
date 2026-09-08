"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useRouter } from "@/i18n/navigation";

import { dissolveTeam, handOverManagement, leaveTeam, removeMember } from "../actions/roster";
import type { TeamActionResult, TeamRole } from "../config";
import { ConfirmButton } from "./confirm-button";

/**
 * Only what the controls need. Deliberately **not** `RosterMember`: props of a
 * client island are serialized into the page, and that type carries every
 * member's email address.
 */
export type RosterControlsMember = {
  userId: string;
  displayName: string;
  role: TeamRole;
};

/**
 * The roster-change controls (#62), rendered at the end of the roster section.
 *
 * Two views on the same island, because the underlying rows are the same:
 *  - **anyone on the roster** gets Leave. The manager gets it too — that is the
 *    only way a sole-member manager can close their team from the UI, and with
 *    others still on the roster the action answers `manager_must_hand_over`,
 *    which is the pointer the rules ask for rather than a hidden button.
 *  - **the manager** (or an admin holding `edit`, who is not on the roster at
 *    all) additionally gets Remove and Hand over on every other row, and
 *    Dissolve.
 *
 * Every one of the four is destructive and irreversible, so each goes through
 * {@link ConfirmButton}. Plain `useState` + `useTransition` + `router.refresh()`,
 * the same shape as `rotate-code-button.tsx`; leaving or dissolving navigates to
 * the profile instead, because the page the runner is on has just stopped being
 * theirs (or stopped existing).
 */
export function RosterControls({
  slug,
  roster,
  viewerUserId,
  isManager,
}: {
  slug: string;
  roster: RosterControlsMember[];
  viewerUserId: string | null;
  /** The team's manager, or an admin with `edit` acting for them. */
  isManager: boolean;
}) {
  const t = useTranslations("teams.roster");
  const tReasons = useTranslations("teams.reasons");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isOnRoster = Boolean(viewerUserId) && roster.some((m) => m.userId === viewerUserId);
  const others = roster.filter((m) => m.role !== "manager" && m.userId !== viewerUserId);

  function run(call: () => Promise<TeamActionResult>, leaving: boolean) {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await call();
      if (!result.ok) {
        setError(tReasons(result.reason));
        return;
      }
      if (leaving) {
        // The team page is gone (dissolve) or no longer the viewer's (leave).
        router.push("/profile");
      }
      router.refresh();
    });
  }

  if (!isOnRoster && !isManager) return null;

  return (
    <div className="iv-actions" data-roster-controls="1" data-roster-manager={isManager ? "1" : "0"}>
      {isManager && others.length > 0 ? (
        <div className="reg-list" data-roster-manager-rows="1">
          {others.map((member) => (
            <div key={member.userId} className="reg-card">
              <div className="reg-card__body">
                <span className="reg-card__title">{member.displayName}</span>
                <div className="reg-card__meta">
                  <ConfirmButton
                    action="handover"
                    target={member.userId}
                    label={t("handOver")}
                    title={t("handOverTitle")}
                    message={t("handOverMessage", { name: member.displayName })}
                    confirmLabel={t("handOverConfirm")}
                    cancelLabel={t("cancel")}
                    disabled={pending}
                    onConfirm={() => run(() => handOverManagement(slug, member.userId), false)}
                  />
                  <ConfirmButton
                    action="remove"
                    target={member.userId}
                    label={t("remove")}
                    title={t("removeTitle")}
                    message={t("removeMessage", { name: member.displayName })}
                    confirmLabel={t("removeConfirm")}
                    cancelLabel={t("cancel")}
                    disabled={pending}
                    onConfirm={() => run(() => removeMember(slug, member.userId), false)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {isManager ? <p className="iv-share__hint">{t("managerHint")}</p> : null}

      <div className="iv-actions">
        {isOnRoster ? (
          <ConfirmButton
            action="leave"
            variant="button"
            label={t("leave")}
            title={t("leaveTitle")}
            message={t("leaveMessage")}
            confirmLabel={t("leaveConfirm")}
            cancelLabel={t("cancel")}
            disabled={pending}
            onConfirm={() => run(() => leaveTeam(slug), true)}
          />
        ) : null}

        {isManager ? (
          <ConfirmButton
            action="dissolve"
            variant="button"
            label={t("dissolve")}
            title={t("dissolveTitle")}
            message={t("dissolveMessage")}
            confirmLabel={t("dissolveConfirm")}
            cancelLabel={t("cancel")}
            disabled={pending}
            onConfirm={() => run(() => dissolveTeam(slug), true)}
          />
        ) : null}
      </div>

      {pending ? <span className="iv-share__hint">{t("working")}</span> : null}
      {error ? (
        <span className="ff-error-msg" role="alert" data-roster-error="1">
          {error}
        </span>
      ) : null}
    </div>
  );
}
