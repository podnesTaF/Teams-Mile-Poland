"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { FloatField } from "@/components/ui/float-field";
import { useRouter } from "@/i18n/navigation";

import {
  addEntryMember,
  removeEntryMember,
  remindMember,
  withdrawEntry,
  type EntryActionResult,
} from "../actions/entries";
import { ConfirmButton } from "./confirm-button";
import { entryRefusalText } from "./entry-enter-button";

/**
 * The manager's controls on an entry page (PRD #64, user stories 8–13):
 * Remind per unconfirmed member, Remove per member, Add a late recruit,
 * Withdraw the whole entry.
 *
 * One island for all four, the same shape as `roster-controls.tsx`: plain
 * `useState` + `useTransition` + `router.refresh()`, refusals rendered inline
 * from the action's `reason`, and every destructive action behind
 * {@link ConfirmButton}.
 *
 * **Renders nothing but a notice once the entry is checked in.** Add, remove
 * and withdraw are refused with `already_checked_in` by the actions
 * themselves — the composition fixed at the desk must not drift (user story
 * 13) — so showing the buttons would only invite the refusal. Remind goes with
 * them: a checked-in team's members have all confirmed by definition.
 *
 * Add is a `<select>` of roster members who are **not** on the entry, not a
 * free-text field: the action refuses anyone who is not on the roster, and
 * making the manager type a user id to be told that would be a poor way to
 * learn it.
 */

/** One member of the entry, as the controls need them. */
export type ControlsMember = {
  userId: string;
  displayName: string;
  confirmed: boolean;
};

/** A roster member not yet on the entry — a candidate for Add. */
export type ControlsCandidate = {
  userId: string;
  displayName: string;
};

export function EntryManagerControls({
  entryId,
  members,
  candidates,
  locked,
  teamSlug,
}: {
  entryId: string;
  members: ControlsMember[];
  candidates: ControlsCandidate[];
  /** The entry's status is no longer `entered`. */
  locked: boolean;
  /** Where to go after a withdraw — the entry page stops existing. */
  teamSlug: string;
}) {
  const t = useTranslations("teams.entryPage");
  const tEntry = useTranslations("teams.entry");
  const tReasons = useTranslations("teams.reasons");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [addUserId, setAddUserId] = useState<string>("");
  const [pending, startTransition] = useTransition();

  if (locked) {
    return (
      <section className="iv-actions" data-entry-controls="locked">
        <p className="iv-share__hint">{t("lockedControls")}</p>
      </section>
    );
  }

  function run(
    call: () => Promise<EntryActionResult>,
    { leaving = false, ok }: { leaving?: boolean; ok?: string } = {},
  ) {
    if (pending) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await call();
      if (!result.ok) {
        setError(entryRefusalText(result, tEntry, tReasons));
        return;
      }
      if (leaving) {
        router.push(`/teams/${teamSlug}`);
      }
      if (ok) setNotice(ok);
      router.refresh();
    });
  }

  const unconfirmed = members.filter((member) => !member.confirmed);

  return (
    <section className="iv-actions" data-entry-controls="1" data-entry-locked="0">
      <span className="iv-eyebrow">{t("controlsHeading")}</span>

      {members.length > 0 ? (
        <div className="reg-list" data-entry-control-rows="1">
          {members.map((member) => (
            <div key={member.userId} className="reg-card" data-entry-control-row={member.userId}>
              <div className="reg-card__body">
                <span className="reg-card__title">{member.displayName}</span>
                <div className="reg-card__meta">
                  {member.confirmed ? null : (
                    <button
                      type="button"
                      className="iv-linkbtn"
                      onClick={() =>
                        run(() => remindMember(entryId, member.userId), {
                          ok: t("remindSent", { name: member.displayName }),
                        })
                      }
                      disabled={pending}
                      data-entry-action="remind"
                      data-entry-target={member.userId}
                    >
                      {t("remind")}
                    </button>
                  )}
                  <ConfirmButton
                    action="entry-remove"
                    target={member.userId}
                    label={t("remove")}
                    title={t("removeTitle")}
                    message={t("removeMessage", { name: member.displayName })}
                    confirmLabel={t("removeConfirm")}
                    cancelLabel={t("cancel")}
                    disabled={pending}
                    onConfirm={() => run(() => removeEntryMember(entryId, member.userId))}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {unconfirmed.length > 0 ? (
        <p className="iv-share__hint" data-entry-remind-hint="1">
          {t("remindHint")}
        </p>
      ) : null}

      {candidates.length > 0 ? (
        <div className="iv-actions" data-entry-add="1">
          <FloatField
            as="select"
            label={t("addLabel")}
            hint={t("addHint")}
            value={addUserId}
            onChange={(event) => setAddUserId(event.target.value)}
            disabled={pending}
            data-entry-add-select="1"
          >
            <option value="">{t("addPlaceholder")}</option>
            {candidates.map((candidate) => (
              <option key={candidate.userId} value={candidate.userId}>
                {candidate.displayName}
              </option>
            ))}
          </FloatField>
          <button
            type="button"
            className="btn btn-stroke-dark btn-sm"
            onClick={() => {
              if (!addUserId) return;
              const chosen = addUserId;
              setAddUserId("");
              run(() => addEntryMember(entryId, chosen));
            }}
            disabled={pending || !addUserId}
            data-entry-action="add"
          >
            {t("add")}
          </button>
        </div>
      ) : null}

      <div className="iv-actions">
        <ConfirmButton
          action="entry-withdraw"
          variant="button"
          label={t("withdraw")}
          title={t("withdrawTitle")}
          message={t("withdrawMessage")}
          confirmLabel={t("withdrawConfirm")}
          cancelLabel={t("cancel")}
          disabled={pending}
          onConfirm={() => run(() => withdrawEntry(entryId), { leaving: true })}
        />
      </div>

      {pending ? <span className="iv-share__hint">{t("working")}</span> : null}
      {notice ? (
        <span className="iv-share__hint" role="status" data-entry-notice="1">
          {notice}
        </span>
      ) : null}
      {error ? (
        <span className="field-msg" role="alert" data-entry-error="1">
          {error}
        </span>
      ) : null}
    </section>
  );
}
