import { getTranslations } from "next-intl/server";

import type { WalletTxKind } from "@/db/schema/wallet";
import { Link } from "@/i18n/navigation";

import { formatWalletAmount, formatWalletBalance, formatWalletDateTime } from "../format";

/**
 * The ACER balance, on the profile page.
 *
 * **Why a card and not a fourth stat tile.** `pf-stats` counts things that
 * describe the runner (races run, best mile, friends joined) and never change
 * between visits. A balance is money: it moves, it is the one number a reader
 * comes back to check, and it is the only one on the page with actions attached
 * to it. Sitting it in the grey stats grid would file it under trivia — so it
 * gets the accent treatment the wallet page gives its one live asset, and its
 * own row directly under the identity hero.
 *
 * **ACER only, deliberately.** Ace(PL) and ACEG are shown on `/wallet` at zero
 * because that page is the full ledger and hiding two thirds of the asset set
 * there would be dishonest. Here the job is the opposite — one number, read at
 * a glance — and two permanent zeroes beside it would bury it.
 *
 * The last movement is the second half of the answer. "12.00" alone raises
 * "where did that come from"; "+1.00 · Race check-in reward · 22 Aug" answers it
 * without a trip to the history, and on an empty wallet the same slot says how
 * to earn the first one instead of showing a blank.
 */
export type WalletBalanceCardLast = {
  kind: WalletTxKind;
  amountMinor: number;
  createdAt: Date;
};

type WalletBalanceCardProps = {
  /** ACER balance in minor units — `getWalletBalances(...).ACER`. */
  balanceMinor: number;
  locale: string;
  /** Newest ledger row, or `null` on a wallet with no movements yet. */
  last: WalletBalanceCardLast | null;
  /** Whether to offer the top-up shortcut — `isAcerPurchaseEnabled()`. */
  canTopUp: boolean;
};

export async function WalletBalanceCard({
  balanceMinor,
  locale,
  last,
  canTopUp,
}: WalletBalanceCardProps) {
  const t = await getTranslations("wallet");

  return (
    <section className="pf-wal" aria-labelledby="pf-wal-h">
      <div className="pf-wal__main">
        <span className="iv-eyebrow pf-wal__eyebrow" id="pf-wal-h">
          {t("card.eyebrow")}
        </span>
        <p className="pf-wal__amount">
          <span className="pf-wal__value">{formatWalletBalance(balanceMinor, locale)}</span>
          <span className="pf-wal__unit">{t("assets.ACER")}</span>
        </p>
        <p className="pf-wal__note">{t("card.note")}</p>
      </div>

      <div className="pf-wal__side">
        {last ? (
          <p className="pf-wal__last">
            {/* Signed, and coloured by direction — the sign is the point of a
              * movement, and a debit that reads green is a lie at a glance. */}
            <span className="pf-wal__last-amt" data-dir={last.amountMinor < 0 ? "out" : "in"}>
              {formatWalletAmount(last.amountMinor, locale)}
            </span>
            <span className="pf-wal__last-k">{t(`kinds.${last.kind}`)}</span>
            <time className="pf-wal__last-t" dateTime={last.createdAt.toISOString()}>
              {formatWalletDateTime(last.createdAt, locale)}
            </time>
          </p>
        ) : (
          <p className="pf-wal__last pf-wal__last--empty">{t("card.empty")}</p>
        )}

        <div className="pf-wal__cta">
          {canTopUp ? (
            <Link className="btn btn-red btn-sm" href="/wallet#top-up">
              {t("card.topUp")}
            </Link>
          ) : null}
          <Link className="btn btn-stroke-dark btn-sm" href="/wallet">
            {t("card.open")} →
          </Link>
        </div>
      </div>
    </section>
  );
}
