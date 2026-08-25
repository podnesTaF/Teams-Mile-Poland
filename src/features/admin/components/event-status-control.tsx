import { ConfirmSubmit } from "@/features/admin/components/confirm-submit";
import { adminButton } from "@/features/admin/components/shell/admin-button";
import { ADMIN_NOTE } from "@/features/admin/components/shell/admin-card";
import { EventStatusBadge } from "@/features/admin/components/shell/event-status-badge";
import { setEventStatus } from "@/features/admin/event-actions";
import { nextStatuses } from "@/features/admin/event-schemas";
import type { EventStatus } from "@/lib/events/types";
import { cn } from "@/lib/utils";

/**
 * The lifecycle control: where the event is now, what it means publicly, and
 * the moves that are legal from here — each one press, each with the one line
 * about what it does to the public site.
 *
 * The panel offers only legal moves, and does not keep its own opinion about
 * which those are: `nextStatuses` reads the very table `setEventStatus`
 * enforces, so the control cannot offer a door that is about to be locked. What
 * lives here is the wording — the press, and the one line about what the move
 * does to the public site, which is the thing an admin cannot see from the admin
 * side.
 *
 * ```
 * draft ──▶ upcoming ──▶ registration_open ──▶ registration_closed ──▶ completed
 *   └──────────────────── cancelled ◀──────────────────────┘
 * ```
 *
 * Plus two reopen paths, because a mistake made in one click has to be undoable
 * in one click: `registration_closed → registration_open` and
 * `cancelled → upcoming`. Nothing moves back into `draft` — once a night has
 * been announced, un-announcing it is what `cancelled` is for — and nothing
 * moves out of `completed` at all.
 */

/** What each state does on the public site — the thing admin cannot see from here. */
const PUBLIC_MEANING: Record<EventStatus, string> = {
  draft:
    "Admin-only. Its public pages 404 in every locale, the landing does not list it, and it is not built into the static params — but it does show in the admin sidebar, this index and the mailings segment picker.",
  upcoming:
    "Announced. The public event page renders and the landing's series card lists the night, with no Register button — and the reminder chain starts counting down to the date.",
  registration_open:
    "The landing's Register button points at this event and entries are accepted; it is the event the site promotes.",
  registration_closed:
    "The public page still lists the night with its timetable, but registration is refused — entries shut, race still happening.",
  completed:
    "Reads as run: results and the gallery can be published on it, and it drops out of the featured pick and off the mailings page.",
  cancelled:
    "The public page renders with the cancelled notice and no Register button, and it leaves the landing's series cards and the mailing chain. The roster, heats and results stay on the record and stay open in admin.",
};

/**
 * The press, worded as the act rather than as the state it lands in. `draft` has
 * no entry because nothing in the lifecycle moves back into it — un-announcing a
 * night is what `cancelled` is for.
 */
const MOVE_LABEL: Partial<Record<EventStatus, string>> = {
  upcoming: "Announce it",
  registration_open: "Open registration",
  registration_closed: "Close registration",
  completed: "Mark completed",
  cancelled: "Cancel the night",
};

/** The two undo moves say what they undo, not where they land. */
const UNDO_LABEL: Record<string, string> = {
  "registration_closed:registration_open": "Reopen registration",
  "cancelled:upcoming": "Reinstate as upcoming",
};

/**
 * The two moves that get a confirmation. `completed` is the one door with
 * nothing on the other side of it, and `cancelled` is read by everyone who has
 * entered — both are worth a second press, and neither is a hidden rule: the
 * action allows them either way.
 */
const CONFIRM: Partial<Record<EventStatus, { title: string; message: string; confirm: string }>> = {
  completed: {
    title: "Mark this event completed?",
    message:
      "Completed is the end of the lifecycle — there is no move out of it, and cancelling a completed event is refused. Results and the gallery can then be published on it. Anyone still sitting at 'registered' stays on the roster; mark them no-show from the check-in desk if they did not run.",
    confirm: "Mark completed",
  },
  cancelled: {
    title: "Cancel this race night?",
    message:
      "The public page will show the cancelled notice and refuse registration, and the night leaves the landing and the reminder chain. Nobody is emailed by this — tell the people who entered yourself, from Mailings. The roster, heats and results stay on the record, and you can reinstate it as upcoming in one press.",
    confirm: "Cancel the night",
  },
};

export function EventStatusControl({
  locale,
  slug,
  status,
}: {
  locale: string;
  slug: string;
  status: EventStatus;
}) {
  const moves = nextStatuses(status);

  return (
    <div data-event-status-control={status}>
      <div className="flex flex-wrap items-center gap-2.5">
        <EventStatusBadge status={status} />
        <p className={cn(ADMIN_NOTE, "max-w-[78ch] flex-1")}>{PUBLIC_MEANING[status]}</p>
      </div>

      {moves.length === 0 ? (
        <p className={cn(ADMIN_NOTE, "mt-4 max-w-[78ch]")}>
          There is nowhere to move it. Completed is the end of the lifecycle: the night ran, and
          rewriting that is not a state change. If it did not run, its status is wrong — and the
          only way back is a database fix, not a press here.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-admin-line border-t border-admin-line">
          {moves.map((to) => {
            const confirm = CONFIRM[to];
            const label =
              UNDO_LABEL[`${status}:${to}`] ??
              MOVE_LABEL[to] ??
              `Move to ${to.replaceAll("_", " ")}`;
            return (
              <li
                key={to}
                data-event-status-move={to}
                className="flex flex-wrap items-start gap-x-4 gap-y-2 py-3.5"
              >
                <form action={setEventStatus} className="shrink-0">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="status" value={to} />
                  {confirm ? (
                    <ConfirmSubmit
                      label={label}
                      title={confirm.title}
                      message={confirm.message}
                      confirmLabel={confirm.confirm}
                      danger={to === "cancelled"}
                      triggerClassName={adminButton(to === "cancelled" ? "stroke" : "primary")}
                    />
                  ) : (
                    <button type="submit" className={adminButton("primary")}>
                      {label}
                    </button>
                  )}
                </form>
                <p className={cn(ADMIN_NOTE, "min-w-[16rem] max-w-[70ch] flex-1")}>
                  <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-admin-ink-2">
                    {to.replaceAll("_", " ")}
                  </span>{" "}
                  — {PUBLIC_MEANING[to]}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
