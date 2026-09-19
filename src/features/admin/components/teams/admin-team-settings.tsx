"use client";

import { useState } from "react";

import { adminButton } from "@/features/admin/components/shell/admin-button";
import { ADMIN_NOTE, ADMIN_TITLE, adminCard } from "@/features/admin/components/shell/admin-card";
import { AdminField, adminInput } from "@/features/admin/components/shell/admin-field";
import { ACTION_FAILED_TEXT, adminTeamRefusal } from "@/features/admin/components/teams/refusal";
import { rotateTeamCode, updateTeam } from "@/features/teams/actions/team";
import { dissolveTeam } from "@/features/teams/actions/roster";
import { ConfirmButton } from "@/features/teams/components/confirm-button";
import type { TeamActionResult } from "@/features/teams/config";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { useActionRun } from "@/lib/use-action-run";

/**
 * The organiser's edit panel for one team (#63): name, region, description,
 * the recruiting flag, the team code, and the one irreversible act — dissolve.
 *
 * These are the manager's own controls, driven through the manager's own server
 * actions (`updateTeam`, `rotateTeamCode`, `dissolveTeam`), all three of which
 * already admit an admin holding `edit` through `requireTeamManagerOrAdmin`.
 * Nothing about the write is re-implemented here — the difference between this
 * and `TeamForm` / `TeamManagerPanel` is entirely presentational.
 *
 * **Why it is not simply `TeamForm` reused.** That island renders through
 * `useTranslations("teams.form")`, so on `/pl/admin/teams/<slug>` it would
 * answer in Polish inside an English panel. Admin is English-only by convention
 * (cross-cutting checklist §1), so the admin surfaces restate their strings as
 * literals — as every other admin page does — and the refusal copy comes from
 * {@link adminTeamRefusal} rather than from `teams.reasons`.
 *
 * The whole island is only rendered for `edit`; the page renders a read-only
 * note instead for `admin_checkin` and `admin_viewer`. That is an offer, never
 * the gate: each action runs its own `requireTeamManagerOrAdmin` and answers
 * `forbidden` regardless of what the page chose to draw.
 */
export function AdminTeamSettings({
  slug,
  code,
  initial,
}: {
  slug: string;
  code: string;
  initial: { name: string; region: string; description: string; recruiting: boolean };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [region, setRegion] = useState(initial.region);
  const [description, setDescription] = useState(initial.description);
  const [recruiting, setRecruiting] = useState(initial.recruiting);
  const [refused, setRefused] = useState<{ reason: string; text: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useActionRun(() =>
    setRefused({ reason: "failed", text: ACTION_FAILED_TEXT }),
  );

  const ready = name.trim().length >= 3 && region.trim().length >= 2;

  /**
   * One runner for all four actions: clear the last outcome, call, then either
   * show the refusal or refresh the page the server just changed. `after` runs
   * only on success, which is where dissolve leaves for the index — the page
   * it is on has stopped existing.
   */
  function run(call: () => Promise<TeamActionResult>, ok: string, after?: () => void) {
    if (pending) return;
    setRefused(null);
    setNotice(null);
    startTransition(async () => {
      const result = await call();
      if (!result.ok) {
        setRefused({ reason: result.reason, text: adminTeamRefusal(result.reason) });
        return;
      }
      setNotice(ok);
      if (after) after();
      else router.refresh();
    });
  }

  return (
    <section className={adminCard("p-4 sm:p-5")} data-admin-team-settings={slug}>
      <h2 className={ADMIN_TITLE}>Team settings</h2>
      <p className={cn(ADMIN_NOTE, "mt-1 max-w-[78ch]")}>
        The manager&apos;s own controls, run as the organiser. The category is immutable and the
        slug never moves, so a rename keeps the URL a manager already shared.
      </p>

      {refused ? (
        <p
          className="mt-3 rounded-admin border border-admin-line bg-admin-surface-2 px-3 py-2 text-[13px] text-admin-warn"
          role="alert"
          data-admin-refused={refused.reason}
        >
          {refused.text}
        </p>
      ) : null}
      {notice ? (
        <p
          className="mt-3 rounded-admin border border-admin-line bg-admin-surface-2 px-3 py-2 text-[13px] text-admin-ok"
          role="status"
          data-admin-team-notice=""
        >
          {notice}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <AdminField label="Name">
          <input
            className={adminInput()}
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            data-admin-team-field="name"
          />
        </AdminField>
        <AdminField label="Region">
          <input
            className={adminInput()}
            value={region}
            maxLength={60}
            onChange={(event) => setRegion(event.target.value)}
            data-admin-team-field="region"
          />
        </AdminField>
      </div>

      <AdminField label="Description" className="mt-3">
        <textarea
          className={adminInput("h-20 resize-y py-2 leading-relaxed")}
          value={description}
          maxLength={280}
          onChange={(event) => setDescription(event.target.value)}
          data-admin-team-field="description"
        />
      </AdminField>

      <label className="mt-3 flex items-center gap-2 text-[13px] text-admin-ink-2">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 accent-admin-accent"
          checked={recruiting}
          onChange={(event) => setRecruiting(event.target.checked)}
          data-admin-team-field="recruiting"
        />
        Recruiting — the team appears on the public list at <code>/teams</code>
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={adminButton("primary")}
          disabled={!ready || pending}
          onClick={() =>
            run(
              () =>
                updateTeam(slug, {
                  name: name.trim(),
                  region: region.trim(),
                  recruiting,
                  description: description.trim(),
                }),
              "Saved.",
            )
          }
          data-admin-team-save=""
        >
          {pending ? "Working…" : "Save changes"}
        </button>

        <span className={cn(ADMIN_NOTE, "ml-auto")}>
          Team code <code className="font-mono text-admin-ink">{code}</code>
        </span>
        <ConfirmButton
          action="rotate"
          variant="button"
          label="Rotate code"
          title="Issue a new team code?"
          message="The current code stops working at once. Join requests already filed reference the team, not the code, so nothing pending is lost."
          confirmLabel="Rotate it"
          cancelLabel="Cancel"
          disabled={pending}
          onConfirm={() => run(() => rotateTeamCode(slug), "A new code was issued.")}
        />
      </div>

      <div className="mt-5 border-t border-admin-line pt-4">
        <ConfirmButton
          action="dissolve"
          variant="button"
          label="Dissolve team"
          title="Dissolve this team?"
          message="The team, its roster, its invitations and its requests are deleted, the slug and the code stop resolving, and every member is emailed. This cannot be undone."
          confirmLabel="Dissolve it"
          cancelLabel="Cancel"
          disabled={pending}
          onConfirm={() =>
            run(() => dissolveTeam(slug), "The team was dissolved.", () =>
              router.push("/admin/teams"),
            )
          }
        />
        <p className={cn(ADMIN_NOTE, "mt-2 max-w-[78ch]")}>
          Dissolving is a hard delete. Prefer handing management to another member when the team is
          only unattended.
        </p>
      </div>
    </section>
  );
}
