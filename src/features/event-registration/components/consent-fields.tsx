"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import type { ConsentItemsInput } from "@/lib/legal/consent";

/**
 * One consent item as the confirm step needs it: everything the client may know
 * about a `ConsentItem`, minus the manifest itself. The document *version* is
 * deliberately absent — it is read server-side at write time, so a client that
 * has been open since before a re-issue cannot pin an old one.
 */
export type ConsentItemView = {
  id: string;
  docSlug: string;
  /** True for a genuine agree/disagree question (a GDPR `consent`), not a tick. */
  twoAnswer: boolean;
  /**
   * For a `twoAnswer` item, the AGREE sentence, already resolved by the server.
   * Absent for the individual set, which reads `register.consent.image.agree`
   * from this island. The team set passes it, because its wording lives under
   * `legal.teamItems` and a client island must not have to know which catalog
   * an item id belongs to. Ignored for tick items — they share one box (below).
   */
  label?: string;
};

type Props = {
  eventSlug: string;
  items: ConsentItemView[];
  values: ConsentItemsInput;
  onChange: (id: string, value: true | "agree" | "disagree" | undefined) => void;
  /** Item ids the server refused as missing or malformed — highlighted inline. */
  problemItems: string[];
  disabled: boolean;
  /**
   * The one sentence over the combined box, resolved by the caller when the set
   * is not the individual one (`legal.teamItems.combined`). Falls back to
   * `register.consent.combined`.
   */
  combinedLabel?: string;
};

/**
 * The consent section of the confirm step (ADR 0006), reduced to two controls.
 *
 * **One checkbox stands for every tick item of the set** — the acceptance of
 * the Rules and the four declarations — under a single sentence that says all
 * of it, with every document it refers to linked beneath. Ticking it answers
 * all five manifest items at once, so the evidence written is unchanged: five
 * `registration_consents` rows, each naming its own document and version. What
 * changed is the screen, which asked a runner on a phone to read and tick five
 * paragraphs that say "I have read it, I am 18, my data is true" in five ways.
 *
 * **The image question stays its own control**, a pair of radios with neither
 * preselected: it is a GDPR consent, the one thing that may be refused without
 * consequence, and bundling it into the box above would make it neither
 * voluntary nor separate.
 *
 * Presentational and fully controlled: the parent owns the state because it owns
 * the submit. Plain inputs and `.auth-check` / `.radio` classes, no
 * react-hook-form (cross-cutting checklist §7).
 */
export function ConsentFields({
  eventSlug,
  items,
  values,
  onChange,
  problemItems,
  disabled,
  combinedLabel,
}: Props) {
  const t = useTranslations("register");
  const tDocs = useTranslations("legal.docs");
  const flagged = new Set(problemItems);

  const tickItems = items.filter((item) => !item.twoAnswer);
  const questions = items.filter((item) => item.twoAnswer);
  const allTicked = tickItems.length > 0 && tickItems.every((item) => values[item.id] === true);
  const tickFlagged = tickItems.some((item) => flagged.has(item.id));
  // Each document once, in manifest order — the Rules, the Statement, the GDPR
  // clause — however many items point at it.
  const docSlugs = [...new Set(tickItems.map((item) => item.docSlug))];

  function setAll(checked: boolean) {
    for (const item of tickItems) onChange(item.id, checked ? true : undefined);
  }

  return (
    <div className="rp-consent">
      <div className="rp-section__h">{t("consent.title")}</div>
      <p className="rp-section__sub">{t("consent.subtitle")}</p>

      {tickItems.length > 0 ? (
        <div
          className="rp-consent__item"
          data-consent-item={tickItems.map((item) => item.id).join(" ")}
          aria-invalid={tickFlagged || undefined}
        >
          <label className="auth-check">
            <input
              type="checkbox"
              checked={allTicked}
              onChange={(event) => setAll(event.target.checked)}
              disabled={disabled}
              data-consent-combined="1"
            />
            <span>{combinedLabel ?? t("consent.combined")}</span>
          </label>
          <div className="rp-consent__docs">
            <span>{t("consent.readDocs")}</span>
            {docSlugs.map((slug) => (
              <Link
                key={slug}
                href={`/events/${eventSlug}/legal/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                {tDocs(slug)}
              </Link>
            ))}
          </div>
          {tickFlagged ? <span className="field-msg">{t("consent.itemRequired")}</span> : null}
        </div>
      ) : null}

      {questions.map((item) => (
        <fieldset
          key={item.id}
          className="rp-consent__item rp-consent__q"
          aria-invalid={flagged.has(item.id) || undefined}
          data-consent-item={item.id}
        >
          <legend className="rp-consent__legend">{t("consent.image.question")}</legend>
          <div className="rp-consent__radios">
            <label className="radio">
              <input
                type="radio"
                name={`consent-${item.id}`}
                checked={values[item.id] === "agree"}
                onChange={() => onChange(item.id, "agree")}
                disabled={disabled}
              />
              <span>{item.label ?? t("consent.image.agree")}</span>
            </label>
            <label className="radio">
              <input
                type="radio"
                name={`consent-${item.id}`}
                checked={values[item.id] === "disagree"}
                onChange={() => onChange(item.id, "disagree")}
                disabled={disabled}
              />
              <span>{t("consent.image.disagree")}</span>
            </label>
          </div>
          <div className="rp-consent__docs">
            <span>{t("consent.image.note")}</span>
            <Link
              href={`/events/${eventSlug}/legal/${item.docSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="link"
            >
              {tDocs(item.docSlug)}
            </Link>
          </div>
          {flagged.has(item.id) ? (
            <span className="field-msg">{t("consent.answerRequired")}</span>
          ) : null}
        </fieldset>
      ))}
    </div>
  );
}
