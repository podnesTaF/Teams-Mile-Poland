import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

import { formatWalletBalance } from "../format";

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
 * **One supporting line, chosen by state.** An empty wallet is told how ACER is
 * earned; a wallet with a balance is told what that balance is. Both are one
 * muted sentence in the same slot, so the card's height does not move and the
 * reader is never given the sentence that is useless to them. The history of
 * individual movements belongs on `/wallet`, not here.
 */
type WalletBalanceCardProps = {
  /** ACER balance in minor units — `getWalletBalances(...).ACER`. */
  balanceMinor: number;
  locale: string;
  /** Whether to offer the top-up shortcut — `isAcerPurchaseEnabled()`. */
  canTopUp: boolean;
};

export async function WalletBalanceCard({
  balanceMinor,
  locale,
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
        <p className="pf-wal__note">
          {balanceMinor === 0 ? t("card.empty") : t("card.note")}
        </p>
      </div>

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
    </section>
  );
}
