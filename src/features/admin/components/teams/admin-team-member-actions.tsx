"use client";

import { useState } from "react";

import { ACTION_FAILED_TEXT, adminTeamRefusal } from "@/features/admin/components/teams/refusal";
import { handOverManagement, removeMember } from "@/features/teams/actions/roster";
import { ConfirmButton } from "@/features/teams/components/confirm-button";
import type { TeamActionResult } from "@/features/teams/config";
import { useRouter } from "@/i18n/navigation";
import { useActionRun } from "@/lib/use-action-run";

/**
 * Remove / Hand over on one roster row of `/admin/teams/[slug]` (#63).
 *
 * One island per row rather than one for the whole table, so the server keeps
 * rendering the roster (names, roles, sex) and only the two presses cross into
 * the browser — no member's email or id list is serialized into the page beyond
 * the one this row is about.
 *
 * Both calls are the manager's own actions, which already admit an admin with
 * `edit` and answer `forbidden` for `admin_checkin` / `admin_viewer`.
 */
export function AdminTeamMemberActions({
  slug,
  userId,
  name,
}: {
  slug: string;
  userId: string;
  name: string;
}) {
  const router = useRouter();
  const [refused, setRefused] = useState<{ reason: string; text: string } | null>(null);
  const [pending, startTransition] = useActionRun(() =>
    setRefused({ reason: "failed", text: ACTION_FAILED_TEXT }),
  );

  function run(call: () => Promise<TeamActionResult>) {
    if (pending) return;
    setRefused(null);
    startTransition(async () => {
      const result = await call();
      if (!result.ok) {
        setRefused({ reason: result.reason, text: adminTeamRefusal(result.reason) });
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2" data-admin-member-actions={userId}>
      <ConfirmButton
        action="handover"
        target={userId}
        label="Hand over"
        title="Make this member the captain?"
        message={`${name} becomes the captain of this team and the current captain becomes a plain member. They are emailed about it.`}
        confirmLabel="Hand over"
        cancelLabel="Cancel"
        disabled={pending}
        onConfirm={() => run(() => handOverManagement(slug, userId))}
      />
      <ConfirmButton
        action="remove"
        target={userId}
        label="Remove"
        title="Remove this member?"
        message={`${name} loses their seat on this roster and is emailed about it. They can be invited again afterwards.`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        disabled={pending}
        onConfirm={() => run(() => removeMember(slug, userId))}
      />
      {refused ? (
        <span className="text-[12.5px] text-admin-warn" role="alert" data-admin-refused={refused.reason}>
          {refused.text}
        </span>
      ) : null}
    </span>
  );
}
