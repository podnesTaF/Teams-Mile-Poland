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
 * **Not yet centralised: the check-in desk.** `checkin-copy.ts` still words the
 * race-morning family, because that surface's `?ok=` is not a code at all — it
 * carries the bib that was just leased (`ok=12`), which a code→sentence map
 * cannot express — and the same module words the admin panel on the public
 * ticket page, which is not an admin surface and gets no banner. Folding it in
 * belongs to the check-in slice (#43); until then this registry is deliberately
 * incomplete, and a desk code landing here resolves to nothing rather than to
 * the wrong sentence. Two consequences to fix when it folds in: `input` is
 * worded generically here so it stays true on both surfaces, and the desk's
 * `heat_missing` says what this registry's `missing` says.
 *
 * Server-only: the entries read event config and the heat-generation bound, so
 * this must not be pulled into a client bundle. {@link AdminFlash} resolves on
 * the server and hands the finished sentence to the client banner.
 */

import { getBibPool } from "@/lib/events/registry";

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

type FlashCopy = (query: FlashQuery, context: FlashContext) => string;

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
    const copy = ERROR_CODES[error];
    return copy ? { tone: "error", message: copy(query, context) } : null;
  }

  const ok = param(query, "ok");
  if (ok) {
    const copy = OK_CODES[ok];
    return copy ? { tone: "ok", message: copy(query, context) } : null;
  }

  const msg = param(query, "msg").slice(0, MAX_MSG_LENGTH);
  return msg ? { tone: "info", message: msg } : null;
}
