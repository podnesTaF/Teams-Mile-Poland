/**
 * Validating a consent submission against the manifest, and turning it into the
 * rows that get stored.
 *
 * The client renders checkboxes from {@link getConsentItems}; nothing about that
 * is trusted. This module re-derives the required set server-side and answers two
 * questions: *may this submission be written at all*, and *what exactly does it
 * become on disk*. Both are pure — the same reason `manifest.ts` is: no fs, no
 * DB, relative imports only, so a script under `tsx` can call them.
 *
 * Failure is **field-level**, not a banner: the runner needs to be told which box
 * they missed, which is user story 12 and an acceptance criterion of #53.
 */

import {
  type ConsentItem,
  type ConsentKind,
  type DocSet,
  getConsentItems,
  getLegalDoc,
} from "./manifest";

/** What a ticked box stores. Mirrors `ConsentValue` in the schema. */
export type ConsentValue = "true" | "agree" | "disagree";

/**
 * The `items` map as it arrives from the form: `true` for a box that is simply
 * ticked, `"agree"` / `"disagree"` for a question that has two real answers.
 * Deliberately *not* `ConsentValue` — a client that sends the string `"true"` is
 * sending something the form cannot produce, and the schema rejects it.
 */
export type ConsentItemsInput = Record<string, true | "agree" | "disagree">;

/**
 * Why a submission was refused.
 *
 * - `missing` — a `required` item of the set that was not answered at all.
 * - `invalid` — answered with the wrong *shape*: a plain checkbox sent
 *   `"agree"`, or the image question sent `true`.
 * - `unknown` — an item id that belongs to no item of this set. Rejected rather
 *   than ignored: an id we cannot resolve to a document has no version to store,
 *   so storing it would be storing a consent to nothing.
 */
export type ConsentProblem = {
  missing: string[];
  invalid: string[];
  unknown: string[];
};

/** One `registration_consents` row, minus the ids the transaction assigns. */
export type ConsentRowInput = {
  itemId: string;
  kind: ConsentKind;
  docSlug: string;
  /** Copied from the manifest **at write time** — see ADR 0006. */
  docVersion: string;
  value: ConsentValue;
};

/**
 * Whether an item is answered with a genuine yes/no rather than a tick.
 *
 * Keyed on `kind === "consent"`, not on the item's id: a GDPR consent is exactly
 * the thing that may be refused without consequence, and that is what makes it a
 * two-answer question. Today only `imageUse` qualifies; a second one would need
 * no code change here.
 */
export function isTwoAnswerItem(item: ConsentItem): boolean {
  return item.kind === "consent";
}

/**
 * Check a submission's items against the set's manifest entry.
 *
 * Returns `null` when the submission may be written. Every required item must be
 * present; a two-answer item must be `"agree"` or `"disagree"` (**either** of
 * which is a valid, registration-completing answer); everything else must be
 * `true`; unknown ids are refused.
 */
export function validateConsentItems(
  set: DocSet,
  items: ConsentItemsInput,
): ConsentProblem | null {
  const expected = getConsentItems(set);
  const byId = new Map(expected.map((i) => [i.id, i]));

  const missing: string[] = [];
  const invalid: string[] = [];
  const unknown = Object.keys(items).filter((id) => !byId.has(id));

  for (const item of expected) {
    const value = items[item.id];
    if (value === undefined) {
      if (item.required) missing.push(item.id);
      continue;
    }
    if (isTwoAnswerItem(item)) {
      if (value !== "agree" && value !== "disagree") invalid.push(item.id);
    } else if (value !== true) {
      invalid.push(item.id);
    }
  }

  if (missing.length === 0 && invalid.length === 0 && unknown.length === 0) return null;
  return { missing, invalid, unknown };
}

/**
 * The rows a valid submission becomes, in manifest order.
 *
 * Throws on an unregistered document — unreachable after
 * {@link validateConsentItems}, because every item resolves through the same
 * manifest, and a throw inside the registration transaction is the correct
 * outcome anyway: no version, no row, no registration.
 */
export function buildConsentRows(set: DocSet, items: ConsentItemsInput): ConsentRowInput[] {
  return getConsentItems(set).flatMap((item) => {
    const value = items[item.id];
    if (value === undefined) return [];
    const doc = getLegalDoc(item.docSlug);
    if (!doc) throw new Error(`Consent item "${item.id}" names unregistered doc "${item.docSlug}"`);
    return [
      {
        itemId: item.id,
        kind: item.kind,
        docSlug: item.docSlug,
        docVersion: doc.version,
        value: value === true ? ("true" as const) : value,
      },
    ];
  });
}

/**
 * What the deprecated `event_registrations.terms` boolean is now derived from.
 *
 * Not a literal any more, and not "did they submit the form": it is true exactly
 * when every `acceptance`-kind item of the set was accepted — the contractual
 * boxes, which for the individual set is the Rules. Declarations and the image
 * consent are testimony and permission, not terms, so they do not feed it.
 */
export function termsAcceptedFrom(set: DocSet, items: ConsentItemsInput): boolean {
  const acceptances = getConsentItems(set).filter((i) => i.kind === "acceptance");
  if (acceptances.length === 0) return false;
  return acceptances.every((i) => items[i.id] === true);
}
