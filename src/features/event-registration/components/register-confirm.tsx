"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import type { ConsentItemsInput } from "@/lib/legal/consent";
import type { DocSet } from "@/lib/legal/manifest";

import { type AcerShortfall, registerForEvent } from "../actions";
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
  /**
   * What this night costs, in **whole ACER**; `0` is a free night and the cost
   * row falls back to "Free" exactly as it read before fees existed. Resolved
   * server-side through `individualEntryFeeMinor` — this island never reads a
   * price column and never decides what anything costs.
   */
  feeAcer: number;
  /** The runner's ACER at render time, whole ACER. Only shown on a priced night. */
  balanceAcer: number;
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
 * **And this is the last screen before money moves** (ADR 0013). On a priced
 * night the cost row carries the real price instead of "Free", the runner's
 * balance is printed beside it, and a shortfall gets its own card naming both
 * numbers and linking to the top-up — never a bare "not enough", which leaves
 * someone to work out the difference on a phone at a tram stop. The numbers in
 * that card come from the server's refusal, not from the props: between render
 * and press the wallet may have moved.
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
  feeAcer,
  balanceAcer,
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
  const [shortfall, setShortfall] = useState<AcerShortfall | null>(null);
  const [pending, startTransition] = useTransition();
  const paid = feeAcer > 0;

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
    setShortfall(null);
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
        if (result.reason === "insufficient_acer") {
          // Not a terminal state and not a banner over the form: the form is
          // still valid and the runner can finish it the moment the wallet is
          // topped up, so the card sits above it and the consents stay filled.
          // `?? ` never fires in practice — the action always carries both
          // numbers — but a missing shortfall must not render "undefined ACER".
          setShortfall(result.shortfall ?? { needed: feeAcer, balance: balanceAcer });
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
            {/* The cost row is the price on a priced night and "Free" on every
                other one — one row, not a second "fee" row that could disagree
                with it. `data-entry-fee` carries the number in ACER so a
                verifier asserts on the price and not on a translated string. */}
            <Row
              k={t("confirm.cost")}
              v={paid ? t("fee.amount", { amount: feeAcer }) : t("summary.free")}
              sub={paid ? t("fee.wallet", { balance: balanceAcer }) : undefined}
              priceTag
              data-entry-fee={feeAcer}
              data-entry-fee-balance={paid ? balanceAcer : undefined}
            />
          </div>

          {paid ? (
            <p className="slots-note" data-entry-fee-note="1">
              {t("fee.note")}
            </p>
          ) : null}

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
            {shortfall ? (
              <div
                className="banner banner--warn"
                role="status"
                data-entry-fee-short="1"
                data-entry-fee-needed={shortfall.needed}
                data-entry-fee-balance={shortfall.balance}
              >
                <div className="banner__body">
                  <div className="banner__title">{t("fee.insufficientTitle")}</div>
                  <div className="banner__txt">
                    {t("fee.insufficientBody", {
                      needed: shortfall.needed,
                      balance: shortfall.balance,
                    })}{" "}
                    <Link href="/wallet" className="link" data-entry-fee-topup="1">
                      {t("fee.topUp")}
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}
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

/**
 * A summary line. Any `data-*` prop passes through to the row element — the
 * cost row needs machine-readable numbers on it (a verifier must assert the
 * price, not a translated sentence that changes with the locale).
 */
function Row({
  k,
  v,
  sub,
  priceTag,
  ...markers
}: {
  k: string;
  v: string;
  sub?: string;
  priceTag?: boolean;
} & Record<`data-${string}`, string | number | undefined>) {
  return (
    <div className="commit-row" {...markers}>
      <span className="commit-k">{k}</span>
      <span className={priceTag ? "commit-v price-tag" : "commit-v"}>
        {v}
        {sub ? <small>{sub}</small> : null}
      </span>
    </div>
  );
}
