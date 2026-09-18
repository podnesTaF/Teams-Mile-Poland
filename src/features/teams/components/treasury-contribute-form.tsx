"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import {
  TREASURY_TRANSFER_MAX_ACER,
  TREASURY_TRANSFER_MIN_ACER,
  isValidTreasuryAmount,
  minorToAcer,
} from "@/features/wallet/config";
import { formatWalletBalance } from "@/features/wallet/format";
import { useRouter } from "@/i18n/navigation";

import { contributeToTreasury } from "../actions/treasury";

/**
 * A member paying ACER from their own wallet into the team's treasury.
 *
 * The transfer id is minted **per attempt**, held in state and never rendered:
 * the server keys both ledger legs by it, so a double press is a no-op and a
 * fresh id after every result (success or refusal) is what lets the next press
 * be a new intention rather than a replay of the last one (ADR 0012).
 *
 * The balance line and the `min`/`max` are a courtesy; the action re-checks the
 * amount by name and the wallet under a lock, and a form open across a debit
 * elsewhere comes back with `insufficient_balance` in the banner.
 */
export function TreasuryContributeForm({
  slug,
  balanceMinor,
  locale,
}: {
  slug: string;
  /** The viewer's own ACER, in minor units. */
  balanceMinor: number;
  locale: string;
}) {
  const t = useTranslations("teams.treasury");
  const tReasons = useTranslations("teams.reasons");
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [transferId, setTransferId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const parsed = Number(amount);
  const valid = amount !== "" && isValidTreasuryAmount(parsed);
  const short = valid && parsed > minorToAcer(balanceMinor);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || !valid || short) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await contributeToTreasury(slug, { amountAcer: parsed, transferId });
      // Whatever happened, the next press is a new intention.
      setTransferId(crypto.randomUUID());
      if (!result.ok) {
        setError(tReasons(result.reason));
        return;
      }
      setAmount("");
      setNotice(
        result.alreadyRecorded
          ? t("alreadyRecorded")
          : t("contributed", { balance: formatWalletBalance(result.treasuryMinor, locale) }),
      );
      router.refresh();
    });
  }

  return (
    <form
      className="profile-form treasury-form"
      onSubmit={onSubmit}
      data-treasury-form="contribute"
      noValidate
    >
      {error ? (
        <div className="banner banner--red" role="alert">
          <div className="banner__body">
            <div className="banner__txt">{error}</div>
          </div>
        </div>
      ) : null}
      {notice ? (
        <div className="banner banner--ok" role="status">
          <div className="banner__body">
            <div className="banner__txt">{notice}</div>
          </div>
        </div>
      ) : null}

      <div className="form-section">
        <div className="fgrid">
          <label className="block">
            <span className="flabel on-dark">{t("amountLabel")}</span>
            <input
              className="finput on-dark"
              type="number"
              inputMode="numeric"
              min={TREASURY_TRANSFER_MIN_ACER}
              max={TREASURY_TRANSFER_MAX_ACER}
              step={1}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              aria-invalid={short ? true : undefined}
              required
            />
            <span className="fhint">
              {t("amountHint", {
                min: TREASURY_TRANSFER_MIN_ACER,
                max: TREASURY_TRANSFER_MAX_ACER,
              })}
            </span>
          </label>
        </div>
        <p className="fhint" data-treasury-your-balance={balanceMinor}>
          {t("yourBalance", { balance: formatWalletBalance(balanceMinor, locale) })}
        </p>
        {short ? (
          <span className="field-msg" role="alert">
            {tReasons("insufficient_balance")}
          </span>
        ) : null}
      </div>

      <div className="iv-actions">
        <button type="submit" className="btn btn-primary" disabled={pending || !valid || short}>
          {pending ? t("contributing") : t("contribute")}
        </button>
      </div>
    </form>
  );
}
