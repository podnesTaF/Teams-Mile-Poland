"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import { beginCheckout, trackEvent, trackFunnelBlocked } from "@/lib/analytics";
import type { ConsentItemsInput } from "@/lib/legal/consent";
import type { DocSet } from "@/lib/legal/manifest";

import { type AcerShortfall, registerForEvent } from "../actions";
import { ConsentFields, type ConsentItemView } from "./consent-fields";
import { RegisterSummary } from "./register-summary";

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
  /**
   * What this night costs, in **whole ACER**; `0` is a free night and the cost
   * row falls back to "Free" exactly as it read before fees existed. Resolved
   * server-side through `individualEntryFeeMinor` — this island never reads a
   * price column and never decides what anything costs.
   */
  feeAcer: number;
  /** The runner's ACER at render time, whole ACER. Only shown on a priced night. */
  balanceAcer: number;
  /**
   * Card entry fee in whole PLN (ADR 0015); `0` = not card-paid. A card-paid
   * night goes to Stripe Checkout on submit, and the caller passes `feeAcer: 0`
   * for it — a night is never charged in both.
   */
  pricePln: number;
  /** Back from Stripe without paying (`?payment=cancelled`). */
  paymentCancelled?: boolean;
  /**
   * Set when the runner is on a placement roster (ADR 0016): the card confirms
   * the **team race** for that team ("RED"), and the caller passes no price —
   * the team race is free. `null` is the individual mile, as before.
   */
  teamRace?: { team: string } | null;
};

/**
 * Auth-gated confirm step: the consent card on the left, the night's facts,
 * the price and the button on the right (`RegisterSummary`) — the same two-column
 * page the team confirmation screen is, since 2026-09-30 no longer a modal.
 *
 * **This is where consent is captured** (ADR 0006): one combined confirmation
 * covering the Rules and the declarations, and the image question as a genuine
 * yes/no, submitted with the registration so the two are written in one
 * transaction (see `ConsentFields`).
 *
 * **And this is the last screen before money moves** (ADR 0013). On a priced
 * night the cost row carries the real price instead of "Free", the runner's
 * balance is printed beside it, and a shortfall gets its own card naming both
 * numbers and linking to the top-up — never a bare "not enough", which leaves
 * someone to work out the difference on a phone at a tram stop. The numbers in
 * that card come from the server's refusal, not from the props: between render
 * and press the wallet may have moved.
 *
 * Guard failures (verify/profile) route to the right fix; age, duplicate and
 * closed each render their own state rather than a generic banner. Every banner
 * is a translated key chosen by `reason` — the action's English `message` is a
 * log line, never what a Polish runner reads.
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
  feeAcer,
  balanceAcer,
  pricePln,
  paymentCancelled = false,
  teamRace = null,
}: Props) {
  const t = useTranslations("register");
  const router = useRouter();
  const [items, setItems] = useState<ConsentItemsInput>({});
  const [error, setError] = useState<string | null>(null);
  const [problemItems, setProblemItems] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<"age" | "duplicate" | "closed" | "paying" | null>(null);
  const [shortfall, setShortfall] = useState<AcerShortfall | null>(null);
  const [pending, startTransition] = useTransition();
  const paid = feeAcer > 0;
  const cardPaid = pricePln > 0;

  function setItem(id: string, value: true | "agree" | "disagree" | undefined) {
    setItems((current) => {
      const next = { ...current };
      if (value === undefined) delete next[id];
      else next[id] = value;
      return next;
    });
  }

  /**
   * Which items the *client* can already see are unanswered. Purely for the hint
   * under the button — the decision that matters is the server's, re-derived
   * from the manifest.
   */
  const unanswered = consentItems.filter((item) => items[item.id] === undefined).map((i) => i.id);
  const complete = unanswered.length === 0;

  function run() {
    if (pending) return;
    setError(null);
    setProblemItems([]);
    setShortfall(null);
    startTransition(async () => {
      const result = await registerForEvent(eventSlug, { docSet, locale: docLocale, items });
      if (!result.ok) {
        if (result.reason === "profile" || result.reason === "verify" || result.reason === "insufficient_acer") {
          trackFunnelBlocked("event_register", result.reason, { event_slug: eventSlug });
        }
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
        if (result.reason === "payment_pending") {
          setOutcome("paying");
          return;
        }
        if (result.reason === "payment_unavailable") {
          setError(t("payment.unavailable"));
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
          setError(t("consent.validationError"));
          return;
        }
        setError(t("errors.failed"));
        return;
      }
      if ("checkoutUrl" in result) {
        beginCheckout({
          kind: "entry_individual",
          itemId: eventSlug,
          itemName: eventName,
          value: pricePln,
          currency: "PLN",
        });
      } else {
        trackEvent("event_register", { event_slug: eventSlug, fee: paid ? "acer" : "free" });
      }
      // Absolute URLs either way — Stripe Checkout, or the signed ticket.
      window.location.assign("checkoutUrl" in result ? result.checkoutUrl : result.ticketUrl);
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
  if (outcome === "paying") {
    return <StateCard title={t("payment.settlingTitle")} body={t("payment.settlingBody")} />;
  }
  if (outcome === "closed") {
    return <StateCard title={t("lifecycle.closedTitle")} body={t("lifecycle.closedBody")} />;
  }

  const costLabel = cardPaid
    ? t("payment.amount", { price: pricePln })
    : paid
      ? t("fee.amount", { amount: feeAcer })
      : t("summary.free");

  // The cost is the price on a priced night and "Free" on every other one — one
  // figure, not a second "fee" line that could disagree with it. `data-entry-fee`
  // carries the number in ACER so a verifier asserts on the price and not on a
  // translated string.
  const price = (
    <>
      <strong
        className={cardPaid || paid ? "rp-price" : "rp-price rp-price--free"}
        data-entry-fee={feeAcer}
        data-entry-price-pln={cardPaid ? pricePln : undefined}
        data-entry-fee-balance={paid ? balanceAcer : undefined}
      >
        {costLabel}
      </strong>
      {paid ? <small>{t("fee.wallet", { balance: balanceAcer })}</small> : null}
    </>
  );

  return (
    <div
      className="rp"
      data-race-format={teamRace ? "team" : "individual"}
      data-race-team={teamRace?.team}
    >
      <header className="page-head rp-head">
        <span className="iv-eyebrow">{t("confirm.eyebrow")}</span>
        <h1 className="iv-title">
          {teamRace ? t("teamRace.title", { team: teamRace.team }) : t("confirm.title")}
        </h1>
        <p className="iv-sub">
          {teamRace ? t("teamRace.subtitle", { team: teamRace.team }) : t("confirm.subtitle")}
        </p>
      </header>

      <form onSubmit={onSubmit} className="detail-grid rp-grid">
        <div className="card-white rp-card">
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
          {error ? (
            <div className="banner banner--red" role="alert">
              {error}
            </div>
          ) : null}
          {paymentCancelled && !error ? (
            <div className="banner banner--info" role="status" data-payment-cancelled="1">
              {t("payment.cancelled")}
            </div>
          ) : null}

          <ConsentFields
            eventSlug={eventSlug}
            items={consentItems}
            values={items}
            onChange={setItem}
            problemItems={problemItems}
            disabled={pending}
          />
        </div>

        <RegisterSummary
          eventName={eventName}
          dateTime={dateTime}
          venue={venue}
          runner={{ name: runnerName, email: runnerEmail }}
          price={price}
        >
          <button type="submit" className="btn btn-red btn-block" disabled={pending}>
            {pending
              ? t("submitting")
              : cardPaid
                ? t("payment.submit")
                : t("confirm.submit")}
          </button>
          {!complete && !pending ? (
            <p className="slots-note slots-note--todo">{t("consent.incompleteHint")}</p>
          ) : null}
          {paid ? (
            <p className="slots-note" data-entry-fee-note="1">
              {t("fee.note")}
            </p>
          ) : null}
          <p className="slots-note">
            {teamRace
              ? t("teamRace.note")
              : cardPaid
                ? t("payment.note", { price: pricePln })
                : t("confirm.note")}{" "}
            {t("consent.requiredNotice")}
          </p>
          <p className="slots-note" data-spam-note="1">
            {t.rich("confirm.spamNote", { b: (chunks) => <strong>{chunks}</strong> })}
          </p>
        </RegisterSummary>
      </form>
    </div>
  );
}

function StateCard({ title, body }: { title: string; body: string }) {
  return (
    <section className="card-white rp-state">
      <h1 className="rp-state__title">{title}</h1>
      <p className="iv-sub">{body}</p>
    </section>
  );
}
