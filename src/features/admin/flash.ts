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
 * Server-only: the entries read event config and the heat-generation bound, so
 * this must not be pulled into a client bundle. {@link AdminFlash} resolves on
 * the server and hands the finished sentence to the client banner.
 */

import { getBibPool } from "@/lib/events/registry";

import { checkedInText, checkinErrorText } from "./checkin-copy";
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
 * What the query string cannot carry but the copy needs — currently just the
 * event, so pool-bounded messages can name the real number.
 */
export type FlashContext = {
  slug?: string;
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
};

/** Refusal copy, keyed by the `?error=` code the action redirected with. */
const ERROR_CODES: Record<string, FlashCopy> = {
  count: () => `Enter how many heats to generate (1–${MAX_GENERATE_HEATS}).`,
  capacity: (_q, ctx) => {
    const pool = ctx.slug ? getBibPool(ctx.slug) : null;
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
};

/** A `?heat=` longer than this is not a heat number; see {@link MAX_MSG_LENGTH}. */
const MAX_HEAT_LENGTH = 12;

/**
 * The check-in desk's confirmation. Not a code: `?ok=` is the number the runner
 * has just been handed (`ok=12`), or `pending` when the pool was empty and they
 * were marked present bib-less (ADR 0003). Anything else is not the desk
 * talking, so this declines rather than guessing.
 */
const deskCheckedIn: FlashCopy = (query) => {
  const ok = param(query, "ok");
  if (ok !== "pending" && !/^\d+$/.test(ok)) return null;
  // The placement is named in the sentence, so it is bounded for the same reason
  // `?msg=` is: a heat number is three characters, and a hand-edited URL should
  // not be able to write a paragraph into the banner.
  return checkedInText(ok, param(query, "heat").slice(0, MAX_HEAT_LENGTH));
};

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
    pool: context.slug ? getBibPool(context.slug) : 0,
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
