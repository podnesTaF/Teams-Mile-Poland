/**
 * Filling the corpus' hand-placed tokens.
 *
 * Every document that has a blank to fill carries a `__TOKEN__` where the
 * approved `.docx` had either an underscore run or a date hardcoded to one race
 * night. Two call sites, one function:
 *
 *  - **unsigned preview** (`/[locale]/events/[slug]/legal/[doc]`, this slice) —
 *    only the event date is known, so every personal token and `__SIGN_DATE__`
 *    render as a visible blank line. A reader can see at a glance that nothing
 *    has been accepted yet.
 *  - **statement print** (#54) — the same call with the snapshot from the consent
 *    record, plus a rendered `__SIGNATURE_BLOCK__` attestation.
 *
 * A token with no value becomes {@link BLANK_LINE}, never an empty string: an
 * unfilled field must *look* unfilled on paper. An unknown token is left alone
 * rather than blanked, so a document that gains a token before the code knows
 * about it renders visibly wrong instead of invisibly empty.
 *
 * Pure string work — no fs, no React — so #54 can reuse it verbatim.
 */

/**
 * The blank a missing value renders as. A dotted rule inside `.legal-prose`
 * (`legal.css`), and a real ruled line on paper under `@media print`.
 */
export const BLANK_LINE = '<span class="fill-blank">&nbsp;</span>';

/**
 * Every token the corpus uses. Keys are the literal strings in the HTML; values
 * are the {@link LegalTokens} field that fills them.
 *
 * `__DOC_VERSION_DATE__` is in the reference module's documented token set but
 * appears in no document today — the RODO clause it was meant for ends in
 * `__SIGN_DATE__` instead. It is supported anyway so a re-issue that places it
 * needs no code change.
 */
export const LEGAL_TOKENS = {
  __EVENT_DATE__: "eventDate",
  __SIGN_DATE__: "signDate",
  __FULL_NAME__: "fullName",
  __BIRTH_DATE__: "birthDate",
  __PHONE_EMAIL__: "phoneEmail",
  __ADDRESS__: "address",
  __EMERGENCY_CONTACT__: "emergencyContact",
  __DOC_VERSION_DATE__: "docVersionDate",
  __SIGNATURE_BLOCK__: "signatureBlock",
} as const satisfies Record<string, keyof LegalTokens>;

/**
 * Values for the corpus' tokens. Every field is optional and every missing one
 * becomes a blank line, so the preview is just "pass the event date and nothing
 * else".
 *
 * `signatureBlock` is trusted HTML the caller builds (#54's attestation); every
 * other field is plain text. Nothing here is ever runner-supplied markup — the
 * snapshot values are text captured from form fields, so #54 must escape them
 * before passing them in.
 */
export type LegalTokens = {
  /** The event's date, spelled out: "1 sierpnia 2026". */
  eventDate?: string;
  /** The date consent was actually recorded. Blank in the unsigned preview. */
  signDate?: string;
  fullName?: string;
  birthDate?: string;
  phoneEmail?: string;
  address?: string;
  emergencyContact?: string;
  /** A document's own issue date, where a document prints one. */
  docVersionDate?: string;
  /** The electronic attestation that replaces the pen-and-paper signature line. */
  signatureBlock?: string;
};

/**
 * Substitute the tokens in a document's HTML.
 *
 * Plain `split`/`join` rather than a regex: the tokens are fixed literals, and
 * a value containing `$&` must not be re-interpreted as a replacement pattern.
 */
export function fillLegalTokens(html: string, tokens: LegalTokens): string {
  let out = html;
  for (const [token, field] of Object.entries(LEGAL_TOKENS)) {
    if (!out.includes(token)) continue;
    const value = tokens[field as keyof LegalTokens];
    out = out.split(token).join(value && value.length > 0 ? value : BLANK_LINE);
  }
  return out;
}
