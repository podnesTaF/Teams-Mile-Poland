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
   * The checkbox label, already resolved by the server (for `twoAnswer`, the
   * AGREE sentence).
   *
   * Absent for the individual set, which keeps reading
   * `register.consent.items.<id>` / `register.consent.image.agree` from this
   * island — unchanged behaviour. The team set (#68) passes it, because its
   * labels live under `legal.teamItems.<id>` and are the *same six ids* against
   * different documents and different wording: a `t()` branch inside a client
   * island would have to know which namespace an item id belongs to, which is
   * exactly the knowledge the server already has. Passing the resolved string
   * in keeps this island ignorant of both catalogs.
   */
  label?: string;
};

type Props = {
  eventSlug: string;
  items: ConsentItemView[];
  values: ConsentItemsInput;
  onChange: (id: string, value: true | "agree" | "disagree" | undefined) => void;
  emergencyContact: string;
  onEmergencyContact: (value: string) => void;
  address: string;
  onAddress: (value: string) => void;
  /** Item ids the server refused as missing or malformed — highlighted inline. */
  problemItems: string[];
  /** Field-level errors keyed by input name (`emergencyContact`, `address`). */
  fieldErrors: Record<string, string>;
  disabled: boolean;
};

/**
 * The consent section of the confirm step (ADR 0006, user stories 6–12).
 *
 * One checkbox per declaration and acceptance — never one blanket "I accept the
 * terms" — each linking out to the full document at
 * `/events/[slug]/legal/[doc]`, the public route from #52. The image question is
 * a real pair of radios with **neither preselected**: a consent that is on by
 * default is not a consent, and refusing costs nobody their entry.
 *
 * Presentational and fully controlled: the parent owns the state because it owns
 * the submit. Plain inputs and `.auth-check` / `.radio` / `.finput` classes, no
 * react-hook-form (cross-cutting checklist §7).
 */
export function ConsentFields({
  eventSlug,
  items,
  values,
  onChange,
  emergencyContact,
  onEmergencyContact,
  address,
  onAddress,
  problemItems,
  fieldErrors,
  disabled,
}: Props) {
  const t = useTranslations("register");
  const flagged = new Set(problemItems);

  return (
    <div className="form-section" style={{ marginTop: 28 }}>
      <div className="form-section__h">{t("consent.title")}</div>
      <p className="form-section__sub">{t("consent.subtitle")}</p>

      {items.map((item) =>
        item.twoAnswer ? (
          <fieldset
            key={item.id}
            style={{ border: 0, padding: 0, margin: "18px 0 0" }}
            aria-invalid={flagged.has(item.id) || undefined}
            data-consent-item={item.id}
          >
            <legend className="flabel" style={{ marginBottom: 10 }}>
              {t(`consent.image.question`)}
            </legend>
            <div className="radios" style={{ flexDirection: "column", gap: 12 }}>
              <label className="radio" style={{ alignItems: "flex-start" }}>
                <input
                  type="radio"
                  name={`consent-${item.id}`}
                  checked={values[item.id] === "agree"}
                  onChange={() => onChange(item.id, "agree")}
                  disabled={disabled}
                />
                <span>
                  {item.label ?? t("consent.image.agree")}
                  <small style={{ display: "block", opacity: 0.7 }}>
                    {t("consent.image.agreeNote")}
                  </small>
                </span>
              </label>
              <label className="radio" style={{ alignItems: "flex-start" }}>
                <input
                  type="radio"
                  name={`consent-${item.id}`}
                  checked={values[item.id] === "disagree"}
                  onChange={() => onChange(item.id, "disagree")}
                  disabled={disabled}
                />
                <span>
                  {t("consent.image.disagree")}
                  <small style={{ display: "block", opacity: 0.7 }}>
                    {t("consent.image.disagreeNote")}
                  </small>
                </span>
              </label>
            </div>
            <DocLink eventSlug={eventSlug} docSlug={item.docSlug} />
            {flagged.has(item.id) ? <span className="field-msg">{t("consent.answerRequired")}</span> : null}
          </fieldset>
        ) : (
          <div key={item.id} style={{ marginTop: 18 }} data-consent-item={item.id}>
            <label className="auth-check" style={{ color: "var(--ink)" }}>
              <input
                type="checkbox"
                checked={values[item.id] === true}
                onChange={(e) => onChange(item.id, e.target.checked ? true : undefined)}
                disabled={disabled}
              />
              <span>{item.label ?? t(`consent.items.${item.id}`)}</span>
            </label>
            <DocLink eventSlug={eventSlug} docSlug={item.docSlug} />
            {flagged.has(item.id) ? <span className="field-msg">{t("consent.itemRequired")}</span> : null}
          </div>
        ),
      )}

      <div className="fgrid" style={{ marginTop: 24 }}>
        <label className="block col-2">
          <span className="flabel">{t("consent.emergencyContact.label")}</span>
          <input
            className="finput"
            name="emergencyContact"
            value={emergencyContact}
            onChange={(e) => onEmergencyContact(e.target.value)}
            placeholder={t("consent.emergencyContact.placeholder")}
            maxLength={200}
            disabled={disabled}
            required
          />
          {fieldErrors.emergencyContact ? (
            <span className="field-msg">{fieldErrors.emergencyContact}</span>
          ) : (
            <span className="iv-note" style={{ marginTop: 4, display: "block" }}>
              {t("consent.emergencyContact.hint")}
            </span>
          )}
        </label>
        <label className="block col-2">
          <span className="flabel">{t("consent.address.label")}</span>
          <input
            className="finput"
            name="address"
            value={address}
            onChange={(e) => onAddress(e.target.value)}
            placeholder={t("consent.address.placeholder")}
            maxLength={300}
            disabled={disabled}
          />
          {fieldErrors.address ? (
            <span className="field-msg">{fieldErrors.address}</span>
          ) : (
            <span className="iv-note" style={{ marginTop: 4, display: "block" }}>
              {t("consent.address.hint")}
            </span>
          )}
        </label>
      </div>
    </div>
  );
}

/**
 * The "read the full document" link beside every item (user story 6).
 *
 * `target="_blank"`: opening the 4000-word Regulamin in place would throw away a
 * half-filled form, and the confirm step may itself be a modal.
 *
 * The event-scoped route serves **both** document sets, so the team
 * confirmation screen (#68) needs no second link shape: of the team items' three
 * documents only `team-regulations` carries the manifest's `eventless` flag, so
 * `/legal/team-oswiadczenie` and `/legal/team-rodo` 404 by design (see
 * `src/app/[locale]/legal/[doc]/page.tsx`) — and this route is in any case the
 * only one that prints the night's date into the text.
 */
function DocLink({ eventSlug, docSlug }: { eventSlug: string; docSlug: string }) {
  const t = useTranslations("register");
  return (
    <div style={{ marginTop: 6, marginLeft: 33 }}>
      <Link
        href={`/events/${eventSlug}/legal/${docSlug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="link"
      >
        {t("consent.readDoc")}
      </Link>
    </div>
  );
}
