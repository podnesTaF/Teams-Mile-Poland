"use client";

import { useState, useTransition } from "react";

import { adminButton } from "@/features/admin/components/shell/admin-button";
import { ADMIN_NOTE } from "@/features/admin/components/shell/admin-card";
import { AdminField, adminInput } from "@/features/admin/components/shell/admin-field";
import { adminTeamRefusal } from "@/features/admin/components/teams/refusal";
import { inviteByEmail } from "@/features/teams/actions/invitations";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * **Invite on behalf** — the one power this panel has that a manager does not
 * (#63, PRD #57 → "Admin invites on the team's behalf").
 *
 * There is no separate action for it, and there deliberately is not one: this
 * calls the manager's `inviteByEmail`, which reads `actingAsAdmin` off
 * `requireTeamManagerOrAdmin` and stores `on_behalf = true` on the invitation
 * row. That flag is what flips the mail to its organiser variant
 * ("The organiser invited you to join …") in the *invitee's* locale, and what
 * tags the row in the manager's own pending list — so a runner is never
 * confused by a mail from a team they never contacted, and the manager is never
 * surprised by an invitation they did not send.
 *
 * Eligibility is the manager's, unchanged: an address already on the roster is
 * `already_member`, and inviting an address that already holds a pending
 * invitation reissues that row rather than duplicating it. There is no seat
 * count — a roster has no cap (ADR 0011).
 *
 * No datalist of existing accounts: the users table is the whole site's, and
 * shipping every address into the page to autocomplete one field is not worth
 * it. The organiser types the address they were given.
 */
export function AdminInviteOnBehalf({ slug }: { slug: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [refused, setRefused] = useState<{ reason: string; text: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ready = /.+@.+\..+/.test(email.trim());

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || pending) return;
    setRefused(null);
    setNotice(null);
    startTransition(async () => {
      const result = await inviteByEmail(slug, { email: email.trim() });
      if (!result.ok) {
        setRefused({ reason: result.reason, text: adminTeamRefusal(result.reason) });
        return;
      }
      setNotice(`Invited ${result.email} on the team's behalf.`);
      setEmail("");
      router.refresh();
    });
  }

  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2"
      onSubmit={submit}
      data-admin-invite-on-behalf={slug}
    >
      <AdminField label="Invite by email" className="min-w-[240px] flex-1">
        <input
          className={adminInput()}
          type="email"
          autoComplete="off"
          maxLength={200}
          value={email}
          placeholder="runner@example.com"
          onChange={(event) => setEmail(event.target.value)}
        />
      </AdminField>
      <button
        type="submit"
        className={adminButton("primary")}
        disabled={!ready || pending}
        data-admin-invite-submit=""
      >
        {pending ? "Inviting…" : "Invite on behalf"}
      </button>

      <p className={cn(ADMIN_NOTE, "w-full")}>
        The invitee is mailed the organiser variant of the invitation in their own language.
      </p>

      {refused ? (
        <p
          className="w-full text-[12.5px] text-admin-warn"
          role="alert"
          data-admin-refused={refused.reason}
        >
          {refused.text}
        </p>
      ) : null}
      {notice ? (
        <p className="w-full text-[12.5px] text-admin-ok" role="status" data-admin-invite-sent="">
          {notice}
        </p>
      ) : null}
    </form>
  );
}
