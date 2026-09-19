"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  TREASURY_TRANSFER_MAX_ACER,
  TREASURY_TRANSFER_MIN_ACER,
  isValidTreasuryAmount,
  minorToAcer,
} from "@/features/wallet/config";
import { formatWalletBalance } from "@/features/wallet/format";
import { useRouter } from "@/i18n/navigation";
import { useActionRun } from "@/lib/use-action-run";

import { payoutFromTreasury } from "../actions/treasury";

export type PayoutCandidate = { userId: string; displayName: string };

/**
 * The manager paying ACER out of the treasury to one roster member.
 *
 * Rendered only when the server says payouts are on (`isTreasuryPayoutEnabled`,
 * resolved by the page) and the viewer manages the team; the action re-checks
 * both. Same per-attempt transfer id discipline as the contribution form.
 * Candidates are names only — the island never receives an email address.
 */
export function TreasuryPayoutForm({
  slug,
  treasuryMinor,
  candidates,
  locale,
}: {
  slug: string;
  treasuryMinor: number;
  candidates: PayoutCandidate[];
  locale: string;
}) {
  const t = useTranslations("teams.treasury");
  const tReasons = useTranslations("teams.reasons");
  const router = useRouter();
  const [memberUserId, setMemberUserId] = useState(candidates[0]?.userId ?? "");
  const [amount, setAmount] = useState("");
  const [transferId, setTransferId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useActionRun(() => setError(tReasons("failed")));

  const parsed = Number(amount);
  const valid = memberUserId !== "" && amount !== "" && isValidTreasuryAmount(parsed);
  const short = valid && parsed > minorToAcer(treasuryMinor);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || !valid || short) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await payoutFromTreasury(slug, {
        memberUserId,
        amountAcer: parsed,
        transferId,
      });
      setTransferId(crypto.randomUUID());
      if (!result.ok) {
        setError(tReasons(result.reason));
        return;
      }
      setAmount("");
      setNotice(
        result.alreadyRecorded
          ? t("alreadyRecorded")
          : t("paidOut", { balance: formatWalletBalance(result.treasuryMinor, locale) }),
      );
      router.refresh();
    });
  }

  return (
    <form
      className="profile-form treasury-form"
      onSubmit={onSubmit}
      data-treasury-form="payout"
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
            <span className="flabel on-dark">{t("memberLabel")}</span>
            <select
              className="finput on-dark"
              value={memberUserId}
              onChange={(event) => setMemberUserId(event.target.value)}
              required
            >
              {candidates.map((candidate) => (
                <option key={candidate.userId} value={candidate.userId}>
                  {candidate.displayName}
                </option>
              ))}
            </select>
          </label>
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
        {short ? (
          <span className="field-msg" role="alert">
            {tReasons("treasury_insufficient")}
          </span>
        ) : null}
      </div>

      <div className="iv-actions">
        <button type="submit" className="btn btn-stroke-dark" disabled={pending || !valid || short}>
          {pending ? t("payingOut") : t("payout")}
        </button>
      </div>
    </form>
  );
}
