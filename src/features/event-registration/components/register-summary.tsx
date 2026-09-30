"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

type Props = {
  eventName: string;
  dateTime: string;
  venue: string;
  /** The signed-in runner, on the confirm step; absent on the guest step. */
  runner?: { name: string; email: string };
  /** The cost row's value — a translated price or "Free" — with its `data-*`. */
  price: ReactNode;
  /** What sits under the price: the submit button and its notes. */
  children: ReactNode;
};

/**
 * The right-hand card of the register page, on both steps: the facts of the
 * night, the price, and the button. It is the same white `slots-card` the event
 * page and the team confirmation screen use, so the register page reads as one
 * more screen of the same flow rather than a dialog dropped over it — which is
 * what the modal this replaced (2026-09-30) was, and why it could not hold
 * these details and a form at once on a desktop.
 *
 * Sticky on desktop (the card's own rule), so the price and the button stay in
 * view while the form scrolls; a single column on a phone, where it comes after
 * the form and the button is the last thing on the page.
 */
export function RegisterSummary({ eventName, dateTime, venue, runner, price, children }: Props) {
  const t = useTranslations("register.confirm");
  return (
    <aside className="reg-aside">
      <div className="slots-card reg-summary">
        <dl className="reg-facts">
          <Fact k={t("race")} v={eventName} />
          <Fact k={t("dateTime")} v={dateTime} />
          <Fact k={t("venue")} v={venue} />
          <Fact k={t("distance")} v={t("distanceValue")} sub={t("distanceSub")} />
          {runner ? <Fact k={t("runner")} v={runner.name} sub={runner.email} /> : null}
        </dl>
        <div className="reg-cost">
          <span className="reg-k">{t("cost")}</span>
          {price}
        </div>
        <div className="reg-actions">{children}</div>
      </div>
    </aside>
  );
}

/** One fact: a small label over its value. */
function Fact({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="reg-fact">
      <dt className="reg-k">{k}</dt>
      <dd>
        {v}
        {sub ? <small>{sub}</small> : null}
      </dd>
    </div>
  );
}
