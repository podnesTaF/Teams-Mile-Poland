"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import {
  ConsentFields,
  type ConsentItemView,
} from "@/features/event-registration/components/consent-fields";
import type { ConsentItemsInput } from "@/lib/legal/consent";

import { confirmTeamParticipation } from "../actions/confirm";

/**
 * The member's confirmation form (PRD #64, user stories 16–23; issue #68).
 *
 * The one screen a regular member ever fills in, and it is deliberately the
 * *individual* confirm step's consent island with the team item set —
 * `ConsentFields`, unchanged machinery, resolved team labels and hrefs passed
 * in as props (see `ConsentItemView.label`). Reusing it is not just less code:
 * a second checkbox renderer would be a second place the image question could
 * quietly acquire a default answer, and a consent that is on by default is not
 * a consent.
 *
 * What this island adds around it is the four terminal states the issue lists,
 * each its own card rather than a banner over a dead form: already confirmed
 * (with the ticket link), underage, cancelled, and the validation refusal that
 * names the item. The `age` and `cancelled` states are also rendered by the
 * page, server-side, before this island ever mounts — these are the
 * defence-in-depth twins, reached when the night is called off or a birth date
 * changes between page load and submit.
 *
 * Plain `useState` + `useTransition`, no react-hook-form (cross-cutting
 * checklist §7). The parent owns nothing: this island owns the submit, so it
 * owns the state.
 */

/** The facts the summary rows print — resolved server-side, never re-derived. */
export type TeamConfirmFacts = {
  eventName: string;
  /** Long, locale-formatted event date. */
  eventDate: string;
  /** "Venue, City", or "" when the event carries neither. */
  venue: string;
  teamName: string;
  memberName: string;
  memberEmail: string;
  /** `YYYY-MM-DD`, or "" when the profile carries no usable date. */
  memberBirthDate: string;
  /** The profile phone, or "" — shown so the member can see what is on record. */
  memberPhone: string;
};

type Props = {
  registrationId: string;
  eventSlug: string;
  /**
   * The signed-ticket signature from the emailed link, when the member arrived
   * that way. Passed straight back to the action, which accepts a session *or*
   * this — so a member on a phone with no session can still submit.
   */
  sig: string | null;
  /** The language the documents are being shown in, stored with the evidence. */
  docLocale: "pl" | "en" | "ua";
  consentItems: ConsentItemView[];
  facts: TeamConfirmFacts;
  /** From the member's most recent snapshot, or "" for a first confirmation. */
  prefillEmergencyContact: string;
  prefillAddress: string;
};

export function TeamConfirmForm({
  registrationId,
  eventSlug,
  sig,
  docLocale,
  consentItems,
  facts,
  prefillEmergencyContact,
  prefillAddress,
}: Props) {
  const t = useTranslations("register.teamConfirm");
  // Two sentences the confirm aside says that are not set-specific — "we cannot
  // admit you to the start line without the required consents" and "answer every
  // item and give an emergency contact". Borrowed from the individual step's
  // catalog rather than duplicated under `teamConfirm`, for the same reason the
  // register page borrows the event page's cancelled copy: it must not be
  // possible for the two forms to disagree about what is required.
  const tConsent = useTranslations("register.consent");
  const tReasons = useTranslations("teams.reasons");
  const [items, setItems] = useState<ConsentItemsInput>({});
  const [emergencyContact, setEmergencyContact] = useState(prefillEmergencyContact);
  const [address, setAddress] = useState(prefillAddress);
  const [error, setError] = useState<string | null>(null);
  const [problemItems, setProblemItems] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<
    | { state: "already_confirmed"; ticketUrl: string }
    | { state: "age" | "cancelled" }
    | null
  >(null);
  const [pending, startTransition] = useTransition();

  function setItem(id: string, value: true | "agree" | "disagree" | undefined) {
    setItems((current) => {
      const next = { ...current };
      if (value === undefined) delete next[id];
      else next[id] = value;
      return next;
    });
  }

  /**
   * What the *client* can already see is unanswered — for the hint under the
   * button only. The decision that counts is the server's, re-derived from the
   * manifest, which is why an incomplete form still submits (below).
   */
  const unanswered = consentItems.filter((item) => items[item.id] === undefined).map((i) => i.id);
  const complete = unanswered.length === 0 && emergencyContact.trim().length > 0;

  function run() {
    if (pending) return;
    setError(null);
    setProblemItems([]);
    setFieldErrors({});
    startTransition(async () => {
      const result = await confirmTeamParticipation(
        registrationId,
        { docSet: "team", locale: docLocale, items, emergencyContact, address },
        sig ?? undefined,
      );

      if (!result.ok) {
        if (result.reason === "already_confirmed") {
          setOutcome({
            state: "already_confirmed",
            // The action returns the ticket URL with the refusal precisely so
            // this branch has somewhere to send them.
            ticketUrl: result.ticketUrl ?? "",
          });
          return;
        }
        if (result.reason === "age" || result.reason === "cancelled") {
          setOutcome({ state: result.reason });
          return;
        }
        if (result.reason === "invalid" && result.consent) {
          const refusal = result.consent;
          setProblemItems([...refusal.missing, ...refusal.invalid, ...refusal.unknown]);
          setFieldErrors(refusal.fields);
          setError(t("validationError"));
          return;
        }
        setError(tReasons(result.reason));
        return;
      }

      // Absolute, signed ticket URL — assign directly, exactly as the
      // individual confirm step does. The member's next want is their ticket.
      window.location.assign(result.ticketUrl);
    });
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    // Never block silently: an incomplete form submits and comes back with the
    // server's list of what is missing, which is the only list that counts.
    run();
  }

  // Terminal states, after every hook call so the early returns stay
  // rules-of-hooks safe.
  if (outcome?.state === "already_confirmed") {
    return (
      <StateCard
        state="already_confirmed"
        title={t("already.title")}
        body={t("already.body")}
        ctaHref={outcome.ticketUrl || undefined}
        ctaLabel={t("already.cta")}
      />
    );
  }
  if (outcome?.state === "age") {
    return <StateCard state="age" title={t("age.title")} body={t("age.body")} />;
  }
  if (outcome?.state === "cancelled") {
    return <StateCard state="cancelled" title={t("cancelled.title")} body={t("cancelled.body")} />;
  }

  return (
    <form onSubmit={onSubmit} data-team-confirm="form" data-team-confirm-target={registrationId}>
      <div className="detail-grid">
        <div className="card-white" style={{ padding: "clamp(24px, 3vw, 36px)" }}>
          <div className="commit-list" data-team-confirm-prefill="1">
            <Row k={t("details.race")} v={facts.eventName} />
            <Row k={t("details.dateTime")} v={facts.eventDate} />
            {facts.venue ? <Row k={t("details.venue")} v={facts.venue} /> : null}
            <Row k={t("details.team")} v={facts.teamName} />
            <Row k={t("details.member")} v={facts.memberName} sub={facts.memberEmail} />
            {facts.memberBirthDate ? (
              <Row k={t("details.birthDate")} v={facts.memberBirthDate} />
            ) : null}
            {facts.memberPhone ? <Row k={t("details.phone")} v={facts.memberPhone} /> : null}
          </div>

          <ConsentFields
            eventSlug={eventSlug}
            items={consentItems}
            values={items}
            onChange={setItem}
            emergencyContact={emergencyContact}
            onEmergencyContact={setEmergencyContact}
            address={address}
            onAddress={setAddress}
            problemItems={problemItems}
            fieldErrors={fieldErrors}
            disabled={pending}
          />
        </div>

        <aside>
          <div className="slots-card">
            {error ? (
              <div className="banner banner--red" role="alert" data-team-confirm-error="1">
                {error}
              </div>
            ) : null}
            <p className="slots-note" style={{ marginBottom: 12 }}>
              {tConsent("requiredNotice")}
            </p>
            <button
              type="submit"
              className="btn btn-red btn-block"
              disabled={pending}
              data-team-confirm-action="submit"
            >
              {pending ? t("submitting") : t("submit")}
            </button>
            {!complete && !pending ? (
              <p className="slots-note">{tConsent("incompleteHint")}</p>
            ) : null}
            <p className="slots-note">{t("note")}</p>
          </div>
        </aside>
      </div>
    </form>
  );
}

/**
 * One terminal state.
 *
 * Exported so the page can render the *same* card server-side for the states it
 * can already see on load (already confirmed, underage, cancelled) — one card,
 * one set of markers, whichever side reached the conclusion.
 */
export function StateCard({
  state,
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  state: "already_confirmed" | "age" | "cancelled" | "gated";
  title: string;
  body: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <section className="iv-card center-narrow" data-team-confirm-state={state}>
      <span className="iv-eyebrow">{title}</span>
      <p className="iv-sub">{body}</p>
      {ctaHref && ctaLabel ? (
        <div className="iv-actions">
          <a className="btn btn-red" href={ctaHref} data-team-confirm-ticket="1">
            {ctaLabel}
          </a>
        </div>
      ) : null}
    </section>
  );
}

function Row({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="commit-row">
      <span className="commit-k">{k}</span>
      <span className="commit-v">
        {v}
        {sub ? <small>{sub}</small> : null}
      </span>
    </div>
  );
}
