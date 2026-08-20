"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Link, useRouter } from "@/i18n/navigation";

import { createAcerCheckout, type AcerCheckoutRefusal } from "../actions";
import { ACER_CUSTOM_MAX, ACER_CUSTOM_MIN, ACER_PACKS, isValidAcerAmount } from "../config";
import { formatPurchasePrice } from "../format";

/** Either a preset pack, or the custom-amount field. */
type Selection = number | "custom";

/**
 * The refusals that get *shown*. The gate-chain ones are acted on (a redirect to
 * the step that fixes them), never rendered — so they have no message key, and
 * excluding them here is what keeps that true.
 */
type ShownRefusal = Exclude<AcerCheckoutRefusal, "auth" | "verify" | "profile">;

/**
 * The wallet's **only** client island: pick an amount, get sent to Stripe.
 *
 * Everything else on the page is server-rendered, and this is interactive only
 * because choosing between four packs and a free-text amount is a choice with
 * running feedback — the payer should see what they will be charged before they
 * commit, not after a round trip.
 *
 * The bounds it reads are the same constants the server action enforces
 * (`config.ts`), so `min`/`max`/`step` on the field and the rule that actually
 * decides are one set of numbers. The field is a courtesy; the action is the
 * gate. Nothing here mentions withdrawal, cash-out or transfer, because none of
 * those exist — ACER is prepaid platform credit and the copy says only that.
 */
type Props = {
  /**
   * The buyer's address, for the verify-email hop. Without it that page's resend
   * button is inert (`VerifyEmailView` returns early on a missing email), so the
   * gate step would be a dead end.
   */
  email: string;
  /** The page's own path, so it stays the single owner of where the gate returns. */
  redirectTo: string;
};

export function AcerPurchaseForm({ email, redirectTo }: Props) {
  const t = useTranslations("wallet");
  const locale = useLocale();
  const router = useRouter();

  const [selection, setSelection] = useState<Selection>(ACER_PACKS[0]);
  const [custom, setCustom] = useState("");
  const [refusal, setRefusal] = useState<ShownRefusal | null>(null);
  const [pending, startTransition] = useTransition();

  // `Number("")` is 0, which is out of range — so an untouched custom field is
  // simply not a valid amount, with no separate empty case to carry around.
  const amount = selection === "custom" ? Number(custom.trim()) : selection;
  // The same function the action enforces, not a second copy of the rule.
  const valid = isValidAcerAmount(amount);

  function choose(next: Selection) {
    setSelection(next);
    setRefusal(null);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!valid) {
      setRefusal("amount");
      return;
    }
    setRefusal(null);

    startTransition(async () => {
      const result = await createAcerCheckout({ amountAcer: amount });
      if (result.ok) {
        // Stripe's hosted page is an absolute URL on their origin — a full
        // assignment, not a client-side route push.
        window.location.assign(result.url);
        return;
      }

      // The page gates before rendering this form, so these only happen when the
      // session changed underneath it (a sign-out in another tab, an email
      // address that stopped being verified). Send them to the fix, carrying the
      // wallet as the destination so the round trip ends where it started.
      const back = encodeURIComponent(redirectTo);
      if (result.reason === "auth") {
        router.push(`/auth/sign-up?redirectTo=${back}`);
        return;
      }
      if (result.reason === "verify") {
        router.push(`/auth/verify-email?email=${encodeURIComponent(email)}&redirectTo=${back}`);
        return;
      }
      if (result.reason === "profile") {
        router.push(`/profile?redirectTo=${back}`);
        return;
      }
      setRefusal(result.reason);
    });
  }

  return (
    <section className="wl-buy" aria-labelledby="wl-buy-h">
      <div className="section-label">
        <span className="iv-eyebrow">{t("purchase.title")}</span>
      </div>
      <h2 className="iv-title pf-h2" id="wl-buy-h">
        {t("purchase.heading")}
      </h2>
      <p className="iv-sub">{t("purchase.subtitle")}</p>

      <form className="wl-buy__card" onSubmit={onSubmit} noValidate>
        {refusal ? (
          <p className="wl-flash" data-tone="err" role="alert">
            {t(`purchase.errors.${refusal}`, { min: ACER_CUSTOM_MIN, max: ACER_CUSTOM_MAX })}
          </p>
        ) : null}

        <fieldset className="wl-packs">
          <legend className="flabel on-dark">{t("purchase.packsLabel")}</legend>
          {/* The grid is an inner element, not the fieldset: a `display: grid`
              fieldset makes its own legend a grid item and it steals a column. */}
          <div className="wl-packs__grid">
            {ACER_PACKS.map((pack) => (
              <button
                type="button"
                key={pack}
                className="wl-pack"
                aria-pressed={selection === pack}
                onClick={() => choose(pack)}
              >
                <span className="wl-pack__amount">{pack}</span>
                <span className="wl-pack__unit">{t("assets.ACER")}</span>
                <span className="wl-pack__price">{formatPurchasePrice(pack, locale)}</span>
              </button>
            ))}
            <button
              type="button"
              className="wl-pack wl-pack--custom"
              aria-pressed={selection === "custom"}
              onClick={() => choose("custom")}
            >
              <span className="wl-pack__amount">{t("purchase.customCta")}</span>
              <span className="wl-pack__price">
                {t("purchase.customRange", { min: ACER_CUSTOM_MIN, max: ACER_CUSTOM_MAX })}
              </span>
            </button>
          </div>
        </fieldset>

        {selection === "custom" ? (
          <label className="wl-custom">
            <span className="flabel on-dark">{t("purchase.customLabel")}</span>
            <input
              className="finput on-dark"
              type="number"
              inputMode="numeric"
              min={ACER_CUSTOM_MIN}
              max={ACER_CUSTOM_MAX}
              step={1}
              value={custom}
              onChange={(event) => {
                setCustom(event.target.value);
                setRefusal(null);
              }}
              autoFocus
            />
            <span className="wl-custom__hint">
              {t("purchase.customHint", { min: ACER_CUSTOM_MIN, max: ACER_CUSTOM_MAX })}
            </span>
          </label>
        ) : null}

        <div className="wl-buy__total">
          <span className="wl-buy__total-k">{t("purchase.youPay")}</span>
          <span className="wl-buy__total-v">
            {valid ? formatPurchasePrice(amount, locale) : "—"}
          </span>
        </div>

        <button type="submit" className="btn btn-red btn-block" disabled={pending}>
          {pending ? t("purchase.submitting") : t("purchase.submit")}
        </button>

        <p className="wl-buy__note">
          {t.rich("purchase.terms", {
            link: (chunks) => (
              <Link href="/terms" target="_blank" rel="noopener noreferrer">
                {chunks}
              </Link>
            ),
          })}
        </p>
        <p className="wl-buy__note">{t("purchase.note")}</p>
        <p className="wl-buy__note">{t("purchase.redeem")}</p>
        <p className="wl-buy__note">{t("purchase.refund")}</p>
      </form>
    </section>
  );
}
