"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useRouter } from "@/i18n/navigation";
import type { ConsentItemsInput } from "@/lib/legal/consent";
import type { DocSet } from "@/lib/legal/manifest";

import { registerForEvent } from "../actions";
import { ConsentFields, type ConsentItemView } from "./consent-fields";

type Props = {
  eventSlug: string;
  eventName: string;
  eventDate: string;
  eventTime: string | null;
  venue: string;
  runnerName: string;
  runnerEmail: string;
  /** Which corpus this event's participants accept — the event's, not a guess. */
  docSet: DocSet;
  /** The language the documents are being shown in, stored with the evidence. */
  docLocale: "pl" | "en" | "ua";
  consentItems: ConsentItemView[];
  /** From the runner's most recent snapshot, or "" for a first registration. */
  prefillEmergencyContact: string;
  prefillAddress: string;
};

/**
 * Auth-gated confirm step (design `f-register`): a white commit-list summary
 * plus the consent section, and a confirm aside. Registration is free, so
 * success routes straight to the ticket.
 *
 * **This is where consent is captured** (ADR 0006). Every declaration and
 * acceptance is its own checkbox linking to its full document, the image
 * question is a genuine yes/no, and an emergency contact is required — all of it
 * submitted with the registration so the two are written in one transaction.
 *
 * The `?verified=1` auto-submit is gone. A guest returning from the verification
 * link now sees the documents and confirms, because a registration whose
 * acceptance was inherited from a form filled days earlier is exactly the
 * evidence gap this feature closes. Guard failures (verify/profile) still route
 * to the right fix; age, duplicate and closed each render their own state rather
 * than a generic banner.
 */
export function RegisterConfirm({
  eventSlug,
  eventName,
  eventDate,
  eventTime,
  venue,
  runnerName,
  runnerEmail,
  docSet,
  docLocale,
  consentItems,
  prefillEmergencyContact,
  prefillAddress,
}: Props) {
  const t = useTranslations("register");
  const router = useRouter();
  const [items, setItems] = useState<ConsentItemsInput>({});
  const [emergencyContact, setEmergencyContact] = useState(prefillEmergencyContact);
  const [address, setAddress] = useState(prefillAddress);
  const [error, setError] = useState<string | null>(null);
  const [problemItems, setProblemItems] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<"age" | "duplicate" | "closed" | null>(null);
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
   * Which items the *client* can already see are unanswered. Purely to keep the
   * submit button honest and to highlight without a round-trip — the decision
   * that matters is the server's, re-derived from the manifest.
   */
  const unanswered = consentItems.filter((item) => items[item.id] === undefined).map((i) => i.id);
  const complete = unanswered.length === 0 && emergencyContact.trim().length > 0;

  function run() {
    if (pending) return;
    setError(null);
    setProblemItems([]);
    setFieldErrors({});
    startTransition(async () => {
      const result = await registerForEvent(eventSlug, {
        docSet,
        locale: docLocale,
        items,
        emergencyContact,
        address,
      });
      if (!result.ok) {
        if (result.reason === "profile") {
          router.push(`/profile?redirectTo=/events/${eventSlug}/register`);
          return;
        }
        if (result.reason === "verify") {
          router.push("/auth/verify-email");
          return;
        }
        if (result.reason === "age") {
          // A defence-in-depth refusal: the event-lifecycle check above the
          // confirm step already screens this out server-side against the
          // event date, so reaching this branch means the runner's stored DOB
          // (or the event date) changed between page load and submit. Render
          // it as its own state, not the generic error banner.
          setOutcome("age");
          return;
        }
        if (result.reason === "duplicate") {
          // Registered in another tab (or a double submit). Refresh so the
          // server re-renders the already-registered card with its ticket link
          // rather than this form inventing one.
          setOutcome("duplicate");
          router.refresh();
          return;
        }
        if (result.reason === "closed") {
          setOutcome("closed");
          router.refresh();
          return;
        }
        if (result.reason === "consent") {
          const refusal = result.consent;
          setProblemItems([
            ...(refusal?.missing ?? []),
            ...(refusal?.invalid ?? []),
            ...(refusal?.unknown ?? []),
          ]);
          setFieldErrors(refusal?.fields ?? {});
          setError(result.message);
          return;
        }
        setError(result.message);
        return;
      }
      // Absolute, signed ticket URL — assign directly.
      window.location.assign(result.ticketUrl);
    });
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    // Never block silently: an incomplete form submits and comes back with the
    // server's list of what is missing, which is the only list that counts.
    run();
  }

  const dateTime = eventTime ? `${eventDate} · ${eventTime}` : eventDate;

  // Terminal states, each its own card rather than a banner over a dead form.
  // Checked after every hook call so these early returns stay rules-of-hooks safe.
  if (outcome === "age") {
    return <StateCard title={t("ageTitle")} body={t("ageBody")} />;
  }
  if (outcome === "duplicate") {
    return <StateCard title={t("alreadyTitle")} body={t("alreadyBody")} />;
  }
  if (outcome === "closed") {
    return <StateCard title={t("lifecycle.closedTitle")} body={t("lifecycle.closedBody")} />;
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="page-head" style={{ marginBottom: 22 }}>
        <span className="iv-eyebrow">{t("confirm.eyebrow")}</span>
        <h1 className="iv-title">{t("confirm.title")}</h1>
        <p className="iv-sub">{t("confirm.subtitle")}</p>
      </div>

      <div className="detail-grid">
        <div className="card-white" style={{ padding: "clamp(24px, 3vw, 36px)" }}>
          <div className="commit-list">
            <Row k={t("confirm.race")} v={eventName} />
            <Row k={t("confirm.dateTime")} v={dateTime} />
            <Row k={t("confirm.venue")} v={venue} />
            <Row k={t("confirm.distance")} v={t("confirm.distanceValue")} sub={t("confirm.distanceSub")} />
            <Row k={t("confirm.runner")} v={runnerName} sub={runnerEmail} />
            <Row k={t("confirm.cost")} v={t("summary.free")} priceTag />
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
            {error ? <div className="banner banner--red">{error}</div> : null}
            <p className="slots-note" style={{ marginBottom: 12 }}>
              {t("consent.requiredNotice")}
            </p>
            <button type="submit" className="btn btn-red btn-block" disabled={pending}>
              {pending ? t("submitting") : t("confirm.submit")}
            </button>
            {!complete && !pending ? (
              <p className="slots-note">{t("consent.incompleteHint")}</p>
            ) : null}
            <p className="slots-note">{t("confirm.note")}</p>
          </div>
        </aside>
      </div>
    </form>
  );
}

function StateCard({ title, body }: { title: string; body: string }) {
  return (
    <section className="iv-card center-narrow">
      <span className="iv-eyebrow">{title}</span>
      <p className="iv-sub">{body}</p>
    </section>
  );
}

function Row({
  k,
  v,
  sub,
  priceTag,
}: {
  k: string;
  v: string;
  sub?: string;
  priceTag?: boolean;
}) {
  return (
    <div className="commit-row">
      <span className="commit-k">{k}</span>
      <span className={priceTag ? "commit-v price-tag" : "commit-v"}>
        {v}
        {sub ? <small>{sub}</small> : null}
      </span>
    </div>
  );
}
