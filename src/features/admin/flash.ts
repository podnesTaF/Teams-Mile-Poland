/**
 * The admin panel's flash registry — one place that turns an action's flash
 * code into the sentence an admin reads.
 *
 * Every admin mutation is a form-post server action that redirects back to the
 * page it came from carrying a short code in the query string (`?ok=published`,
 * `?error=capacity`). Until now each page kept its own `okText`/`errorText`
 * map, so the same code could grow two different explanations on two different
 * pages, and every new surface had to re-invent the wording. This module owns
 * the wording instead; a page hands over its `searchParams` and gets back the
 * one thing it has to render (PRD #34, slice #36).
 *
 * Codes are the panel's shared vocabulary, not per-page names: **one code means
 * one sentence everywhere**. When an action needs to report something new, give
 * it a new code rather than reusing one whose sentence nearly fits.
 *
 * `?msg=` is the older channel — there the action writes the whole sentence
 * itself and there is no code to look up. It stays supported (the actions and
 * their redirect contracts are unchanged) and renders as neutral info.
 *
 * **The check-in desk words itself** (slice #43). Its codes are not all codes:
 * `?ok=` carries the bib that was just leased (`ok=12`), which a code→sentence
 * map cannot express, and the same sentences word the admin panel on the public
 * ticket page — not an admin surface, and it gets no banner. So `checkin-copy.ts`
 * stays the place the race-morning family is said, and this module *falls
 * through* to it for anything its own tables do not answer. A code unknown to
 * both still resolves to nothing rather than to an empty banner.
 *
 * The fall-through is **not scoped to the desk**, and deliberately so: this
 * module resolves by code, not by surface, so `?ok=7` says "Checked in · bib #7"
 * on whatever page it arrives at. That is the rule above ("one code means one
 * sentence everywhere"), not an exception to it — but it does mean the desk's
 * vocabulary is now the panel's, so a future action on another surface must not
 * take `ok=<digits>`, `pending`, or any `checkin-copy` code to mean something
 * else. Only the desk emits them today.
 *
 * Not everything the panel says arrives as a code. The event settings page
 * carries a standing warning about mail already sent for an event, which no
 * redirect can hand it — {@link remindersSentNotice} words that here too, so the
 * panel keeps one voice for one fact.
 *
 * Server-only: the entries read the heat-generation bound, so this must not be
 * pulled into a client bundle. {@link AdminFlash} resolves on the server and
 * hands the finished sentence to the client banner. What it does *not* read is
 * the event — see {@link FlashContext}; resolving one is a DB read now, and this
 * layer stays synchronous.
 */

import { checkinErrorText, checkinOkText } from "./checkin-copy";
import { plural } from "./format";
import { MAX_GENERATE_HEATS } from "./heats-data";

/** How the banner reads the outcome: a success, a refusal, or a bare note. */
export type FlashTone = "ok" | "error" | "info";

export type Flash = {
  tone: FlashTone;
  message: string;
};

/** A page's awaited `searchParams`, whatever else it also carries. */
export type FlashQuery = Record<string, string | string[] | undefined>;

/**
 * What the query string cannot carry but the copy needs: the event, and its bib
 * pool, so pool-bounded messages can name the real number.
 *
 * `bibPool` is passed in rather than looked up here **on purpose**. Events are
 * DB rows now, so reading one is async — and this module is a code→sentence map,
 * the one layer that should stay synchronous and side-effect-free. Every page
 * that renders `<AdminFlash>` is already an async server component, so it
 * resolves the pool and hands it over; the copy stays a pure function of what it
 * was given. Omit it and the pool-bounded sentences fall back to their
 * unbounded wording rather than guessing a number.
 */
export type FlashContext = {
  slug?: string;
  /** How many bibs the event can issue — `getBibPool`, which counts the slot list when one is set. */
  bibPool?: number;
  /** The event's slot spec ("101-115, 203") when it issues from a list — lets refusals name the list. */
  bibSpec?: string;
};

/**
 * One code's sentence. It may decline (`null`) — that is how a family that owns
 * several codes can be registered as one entry and still say nothing about a
 * code that is not its own.
 */
type FlashCopy = (query: FlashQuery, context: FlashContext) => string | null;

/** First value of a repeated param, trimmed; `""` when absent. */
function param(query: FlashQuery, key: string): string {
  const raw = query[key];
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
}

/** A count carried back by an action, as a number. */
function count(query: FlashQuery, key: string): number {
  return Number.parseInt(param(query, key), 10) || 0;
}

/**
 * A caveat flag an action sets on an otherwise successful redirect (`?past=1`):
 * the confirmation still reports success, with one more clause on the end.
 */
function flag(query: FlashQuery, key: string): boolean {
  const value = param(query, key);
  return value === "1" || value === "true";
}

/** "3 heats and 1 registration" — several counts read out as one clause. */
function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** A `?status=`/`?from=`/`?to=` longer than this is not a status name. */
const MAX_STATUS_LENGTH = 24;

/** `registration_open` → `registration open`, so a status can sit in a sentence. */
function humanStatus(status: string): string {
  return status.slice(0, MAX_STATUS_LENGTH).replace(/_/g, " ");
}

/**
 * What each lifecycle state means *publicly*, keyed by the raw value the status
 * action redirects with — the thing an admin cannot see from the admin side, and
 * so the whole point of the confirmation.
 *
 * Keyed by `string`, not `EventStatus`, on purpose: this module words a query
 * param, which is someone's URL until an action has validated it, and an
 * unrecognised value has to fall back to a shorter true sentence rather than
 * render `undefined`. The exhaustiveness net for `EventStatus` belongs where a
 * missing state is a bug — the badge and roster maps that must cover them all.
 */
const STATUS_MEANING: Record<string, string> = {
  draft:
    "Status changed to draft — the event is admin-only again: its public pages 404 in every locale and the landing does not list it.",
  upcoming:
    "Status changed to upcoming — the event is announced publicly, with no Register button yet.",
  registration_open:
    "Status changed to registration open — the landing's Register button now points at this event and entries are accepted.",
  registration_closed:
    "Status changed to registration closed — the public page still lists the night, but no new entries are accepted.",
  completed:
    "Status changed to completed — the event reads as run, and its results and gallery can be published.",
  cancelled:
    "Status changed to cancelled — the public page shows the cancelled notice and registration is refused, while the roster, heats and results stay on the record.",
};

/**
 * Appended to a create or an edit that saved a date in the past. Allowed on
 * purpose (a night that already ran gets back-filled), so it is a clause on a
 * confirmation and not a refusal — but it is also what a typo looks like.
 */
const PAST_DATE_CAVEAT =
  "Its date is in the past — allowed, for back-filling a night that already ran, but check the date before announcing it.";

/** Confirmation copy, keyed by the `?ok=` code the action redirected with. */
const OK_CODES: Record<string, FlashCopy> = {
  generated: (q) => `Generated ${plural(count(q, "n"), "heat")}.`,
  updated: () => "Heat updated.",
  deleted: () => "Heat deleted — its runners are back in Unassigned.",
  assigned: (q) => `Moved ${plural(count(q, "n"), "runner")}.`,
  unassigned: (q) => `Unassigned ${plural(count(q, "n"), "runner")}.`,
  // Publishing reports four counts rather than one: "did that actually mail
  // anyone?" is the whole question an admin has after pressing it.
  published: (q) => {
    const published = count(q, "published");
    const failed = count(q, "failed");
    const head =
      published === 0
        ? "Card re-published — it was already live."
        : `Published ${plural(published, "heat")}.`;
    const tail = `${count(q, "notified")} notified, ${count(q, "skipped")} unchanged${
      failed === 0 ? "" : `, ${failed} failed`
    }.`;
    return `${head} ${tail}`;
  },
  // The desk's two heat presses. Named codes, unlike its check-in confirmation
  // below, so they belong in the table like any other.
  finished: (q) => `Heat finished — ${plural(count(q, "returned"), "bib")} back in the pool.`,
  unfinished: (q) =>
    `Heat re-opened — ${plural(count(q, "released"), "bib")} re-leased to its runners.`,
  // Seeding a final reports what it could not move as loudly as what it did:
  // an unlinked qualifier is a real person the admin has to place by hand.
  finalseeded: (q) => {
    const unlinked = count(q, "unlinked");
    const head = `Seeded ${plural(count(q, "n"), "qualifier")} into the heat — press re-publish to notify them.`;
    return unlinked === 0
      ? head
      : `${head} ${plural(unlinked, "qualifying result")} skipped — not linked to any runner; seed them by hand from the builder.`;
  },
  // The builder's manual bib lease (pre-race). Named codes — `ok=<digits>` is
  // the desk's check-in confirmation and must stay the desk's alone.
  bibset: (q) => `Bib #${count(q, "n")} assigned — it is theirs until their heat is finished.`,
  bibcleared: () => "Bib cleared — the number is back in the pool.",
  // The results import replaces whole heats, so the heat count matters as much
  // as the row count; skipped rows are the ones the parser refused.
  resultsimported: (q) => {
    const skipped = count(q, "skipped");
    const head = `Imported ${plural(count(q, "rows"), "result")} across ${plural(count(q, "heats"), "heat")}.`;
    return skipped === 0 ? head : `${head} ${plural(skipped, "row")} skipped — see the file check.`;
  },
  // Publishing carries the counts back so the admin can sanity-check the folder
  // held what they expected before pressing the photos-live mailing.
  mediapublished: (q) =>
    `Gallery published — ${plural(count(q, "photos"), "photo")} and ${plural(count(q, "videos"), "video")} listed from Drive. The event page and landing now show it.`,
  mediaunpublished: () =>
    "Gallery unpublished — the event page shows the coming-soon note again and the gallery link is gone.",
  // The lifecycle control. `?status=` is the state the event landed in, and the
  // sentence says what that state does publicly. `?registered=` is the guard
  // rail: moving to completed with nobody checked in is legal, and worth saying.
  statuschanged: (q) => {
    const head = STATUS_MEANING[param(q, "status")] ?? "Event status changed.";
    const stillRegistered = count(q, "registered");
    return stillRegistered === 0
      ? head
      : `${head} ${plural(stillRegistered, "runner")} never checked in — they stay registered on the roster, so mark them no-show from the check-in desk if they did not run.`;
  },
  // Creation always lands a draft — an unannounced event is the only safe
  // default — so the confirmation's job is to say the event exists but is not
  // live, and where the admin makes it live.
  eventcreated: (q) => {
    const head =
      "Event created as a draft — admin-only for now: its public pages 404 and the landing does not list it. Move it on from this page when it is ready to announce.";
    return flag(q, "past") ? `${head} ${PAST_DATE_CAVEAT}` : head;
  },
  // An edit can save cleanly and still leave two things worth knowing, and both
  // can be true of the same save — so they are clauses of this confirmation
  // rather than codes of their own, the way `published` reports its failures.
  eventupdated: (q) => {
    const parts = [
      "Event saved — the public event page and the landing pick the new details up on the next request, with no deploy.",
    ];
    if (flag(q, "past")) parts.push(PAST_DATE_CAVEAT);
    const strandedHeats = count(q, "heatsoutside");
    if (strandedHeats > 0) {
      parts.push(
        `${plural(strandedHeats, "generated heat")} ${strandedHeats === 1 ? "falls" : "fall"} outside the saved window — heat times are stored facts and did not move with it. Re-time or regenerate them from the Heats tab.`,
      );
    }
    return parts.join(" ");
  },
  eventdeleted: () =>
    "Event deleted for good — it had no registrations, results, heats, gallery or logged emails, so nothing was left pointing at its slug.",
};

/** Refusal copy, keyed by the `?error=` code the action redirected with. */
const ERROR_CODES: Record<string, FlashCopy> = {
  count: () => `Enter how many heats to generate (1–${MAX_GENERATE_HEATS}).`,
  capacity: (_q, ctx) => {
    const pool = ctx.bibPool ?? null;
    return pool === null
      ? "Capacity must be at least 1 — and a heat cannot be larger than the bib pool."
      : `Capacity must be between 1 and ${pool} — a heat cannot be larger than the bib pool.`;
  },
  interval: () => "Enter the spacing between heats in minutes.",
  time: () => "Enter a valid start time.",
  missing: () => "That heat no longer exists — it may have been deleted in another tab.",
  nochange: () => "Nothing to save — fill in a start time or a capacity.",
  noselection: () => "Select some runners first.",
  noheat: () => "Pick a heat to move them into.",
  // Emitted by several actions, all of them meaning the same thing: the post
  // arrived without something it needed, so nothing was touched.
  input: () => "Something required was missing from that form — nothing was changed.",
  publish: () =>
    "Publishing failed — nothing was emailed. Try again; runners already notified are not re-emailed.",
  resultsfile: () =>
    "That file could not be read as timing results — nothing was imported. Preview it to see why.",
  // The builder's manual bib lease. Its invalid-number and taken-number cases
  // reuse the desk's `bib` / `bib_held` sentences via the fall-through below.
  bibclear: () =>
    "Nothing to clear — the runner holds no bib, or they are checked in and their lease belongs to the desk.",
  bibassign: () =>
    "Could not assign — the runner's heat has already run, or the registration no longer exists.",
  mediafolder: () =>
    "That Drive folder could not be read, or holds no photos or videos — nothing was published. Check the ID and that the folder is shared “anyone with the link”.",
  noqualifiers: (q) => {
    const unlinked = count(q, "unlinked");
    return unlinked === 0
      ? "No finished results to seed from — import qualification results first."
      : `Nothing seeded — the ${plural(unlinked, "qualifying result")} in range are not linked to any runner. Seed them by hand from the builder.`;
  },
  // An admin who has just been refused a status change needs to know what *is*
  // allowed, so the whole lifecycle is in the sentence. `?from=`/`?to=` are
  // optional: with them the refusal names the move it turned down, without them
  // it still says the rule.
  transition: (q) => {
    const from = param(q, "from");
    const to = param(q, "to");
    const head =
      from && to
        ? `Cannot move this event from ${humanStatus(from)} to ${humanStatus(to)}.`
        : "That status change is not allowed.";
    return `${head} An event moves forward along draft → upcoming → registration open → registration closed → completed. It can be cancelled from any state except completed, and two moves undo a mistake: registration closed back to registration open, and cancelled back to upcoming. Nothing was changed.`;
  },
  // The hard-delete guard. It names what is holding the event because the admin
  // has to judge whether to go and clear it, and it names the real exit —
  // cancelling — because for a night that people entered, that is the answer.
  not_empty: (q) => {
    const parts: string[] = [];
    const registrations = count(q, "registrations");
    if (registrations > 0) parts.push(plural(registrations, "registration"));
    const results = count(q, "results");
    if (results > 0) parts.push(plural(results, "imported result"));
    const heats = count(q, "heats");
    if (heats > 0) parts.push(plural(heats, "heat"));
    const media = count(q, "media");
    if (media > 0) parts.push(media === 1 ? "a published gallery" : plural(media, "gallery row"));
    const emails = count(q, "emails");
    if (emails > 0) parts.push(plural(emails, "logged email"));
    const held = parts.length === 0 ? "rows attached to it" : joinList(parts);
    return `Cannot delete this event — it still has ${held}. The slug is the only thing tying those rows to it, so deleting the event would strand them. Cancel it instead: the public page says cancelled and registration is refused, while the roster, heats and results stay on the record.`;
  },
  // Saving a pool or slot list that no longer covers a live lease. `?bib=` is a
  // stranded held bib; `?pool=` is the size that was asked for, sent only when
  // the save was a plain pool shrink — a refused slot list has no single number
  // to name, so the sentence names the bib and the rule instead.
  bibpool_in_use: (q) => {
    const bib = count(q, "bib");
    const asked = count(q, "pool");
    const move = asked > 0 ? `shrink the bib pool to ${asked}` : "save that bib list";
    return `Cannot ${move} — bib #${bib} is held by a runner right now and would fall outside the numbers this event can issue. Nothing was changed. Finish that runner's heat to return the bib, or keep #${bib} in the list.`;
  },
  // An unreadable slot spec. Named separately from `input` because the fix is
  // knowing what a spec looks like, and the sentence is the one place to say it.
  bibslots: () =>
    "Enter the bib numbers as a comma-separated list of numbers and ranges — like 101-115, 203 — using whole numbers from 1 to 9999, or leave the field empty to issue 1 up to the bib pool. Nothing was changed.",
  invalid_window: () =>
    "Enter the event window as two times, HH:MM, with the start before the end — the public timetable is generated from the start time.",
};

/** A `?heat=` longer than this is not a heat number; see {@link MAX_MSG_LENGTH}. */
const MAX_HEAT_LENGTH = 12;

/**
 * The check-in family's confirmations, worded by `checkin-copy.ts` — the module
 * the ticket page's admin panel words itself from.
 *
 * Mostly not codes: `?ok=` is the number the runner has just been handed
 * (`ok=12`), or `pending` when the pool was empty and they were marked present
 * bib-less (ADR 0003). `noshow` and `registered` are the family's two named
 * codes, pressed from either surface. Anything else is not this family talking,
 * so `checkinOkText` declines rather than guessing.
 */
const deskCheckedIn: FlashCopy = (query) =>
  // The placement is named in the sentence, so it is bounded for the same reason
  // `?msg=` is: a heat number is three characters, and a hand-edited URL should
  // not be able to write a paragraph into the banner.
  checkinOkText(param(query, "ok"), param(query, "heat").slice(0, MAX_HEAT_LENGTH));

/**
 * The check-in desk's refusals, worded by `checkin-copy.ts` — the module the
 * ticket page's admin panel words itself from, so the desk and the panel cannot
 * drift into explaining the same outcome two ways.
 *
 * Reached only for codes {@link ERROR_CODES} does not itself answer, which
 * settles the two overlaps the desk brings with it: `input` keeps the registry's
 * generic sentence (true on every surface, where the desk's own was
 * desk-specific), and `heat_missing` is worded here — the same sentence as this
 * registry's `missing`, because it is the same accident reported by two codes
 * from two surfaces.
 */
const deskError: FlashCopy = (query, context) =>
  checkinErrorText(param(query, "error"), {
    pool: context.bibPool ?? 0,
    spec: context.bibSpec,
    bibs: param(query, "bibs"),
  });

/** A `?msg=` sentence longer than this is not feedback; it is someone's URL. */
const MAX_MSG_LENGTH = 300;

/**
 * The one flash a page should show, or `null` when its query says nothing.
 *
 * A refusal outranks a confirmation — an action redirects with one or the
 * other, and if both ever arrive the admin needs to see what went wrong.
 * Unknown codes resolve to nothing at all rather than an empty banner, so a
 * stale bookmark or a hand-edited URL renders the page and no feedback.
 */
export function resolveFlash(query: FlashQuery, context: FlashContext = {}): Flash | null {
  const error = param(query, "error");
  if (error) {
    const message = (ERROR_CODES[error] ?? deskError)(query, context);
    return message ? { tone: "error", message } : null;
  }

  const ok = param(query, "ok");
  if (ok) {
    const message = (OK_CODES[ok] ?? deskCheckedIn)(query, context);
    return message ? { tone: "ok", message } : null;
  }

  const msg = param(query, "msg").slice(0, MAX_MSG_LENGTH);
  return msg ? { tone: "info", message: msg } : null;
}

/** Scheduled event mail, worded short enough to be read out in a sentence. */
const MAIL_KIND_LABEL: Record<string, string> = {
  reminder_7d: "the −7-day reminder",
  reminder_3d: "the −3-day reminder",
  reminder_1d: "the −1-day reminder",
  morning: "the morning-of mail",
};

/**
 * The settings page's standing warning that mail has already gone out for this
 * event: a reminder cannot be un-sent, so moving the date can leave participants
 * holding a mail that no longer matches the night, and pulling the date earlier
 * can make the kinds still to go due at once.
 *
 * Not a code, deliberately. No action emits it and no redirect carries it — the
 * form has to say this *before* the date is moved, on a plain page load. It is
 * still said here, in the module that words the panel, and comes back as a
 * {@link Flash} so the page renders it through the same banner. `info` is the
 * fitting tone: nothing succeeded and nothing was refused.
 *
 * It takes the kinds rather than reading `event_email_log`, for the same reason
 * {@link FlashContext} takes `bibPool`: the query is the caller's, the sentence
 * is ours. `kinds` are raw `event_email_log.kind` values, deduplicated here and
 * named as they come if unrecognised. Nothing sent yet, no notice.
 */
export function remindersSentNotice(kinds: readonly string[]): Flash | null {
  const named = [...new Set(kinds)].map((kind) => MAIL_KIND_LABEL[kind] ?? kind);
  if (named.length === 0) return null;
  return {
    tone: "info",
    message: `Mail has already gone out for this event: ${joinList(named)}. It cannot be un-sent, so moving the date leaves those participants holding the old one — and pulling the date earlier can make the kinds still to go due on the next cron run.`,
  };
}
