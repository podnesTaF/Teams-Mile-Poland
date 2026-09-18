import { getTranslations } from "next-intl/server";

import type { WalletTransactionRow } from "@/db/schema";
import {
  formatWalletAmount,
  formatWalletBalance,
  formatWalletDateTime,
} from "@/features/wallet/format";
import { Link } from "@/i18n/navigation";

import { TreasuryContributeForm } from "./treasury-contribute-form";
import { TreasuryPayoutForm, type PayoutCandidate } from "./treasury-payout-form";

/** The prefix a transfer leg's `reference` names its counterparty with. */
const USER_PREFIX = "user:";

/** The user id in a `user:<id>` reference, or null for anything else. */
export function userIdFromReference(reference: string | null | undefined): string | null {
  if (!reference || !reference.startsWith(USER_PREFIX)) return null;
  const id = reference.slice(USER_PREFIX.length);
  return id.length > 0 ? id : null;
}

/**
 * The counterparty line for one treasury row: "from Anna" on money coming in
 * from a member, "to Anna" on a payout, nothing when the row has no person
 * behind it (an organiser's grant says so through its kind already).
 * `names` is the page's batch read; an id it cannot name is shown as nobody
 * rather than as an id.
 */
export function counterpartyLine(
  row: Pick<WalletTransactionRow, "reference" | "amountMinor">,
  names: Map<string, string | null>,
  t: (key: "from" | "to", values: { name: string }) => string,
): string | null {
  const userId = userIdFromReference(row.reference);
  if (!userId) return null;
  const name = names.get(userId);
  if (!name) return null;
  return t(row.amountMinor >= 0 ? "from" : "to", { name });
}

/**
 * The team page's **Treasury** section (ADR 0012), for roster members.
 *
 * A server component that renders what the page read: the balance, the
 * governance sentence (who can pay in, who decides, what dissolve does), the
 * last few movements with first names for counterparties, and a link to the
 * full history. Two islands hang off it — every member's pay-in form, and the
 * manager's payout form when payouts are switched on. Nothing here gates
 * itself; the page decides who sees it, and the actions decide who may act.
 */
export async function TeamTreasury({
  slug,
  locale,
  treasuryMinor,
  viewerBalanceMinor,
  canContribute,
  payout,
  recent,
  names,
}: {
  slug: string;
  locale: string;
  treasuryMinor: number;
  /** The viewer's own ACER in minor units; only read when they may contribute. */
  viewerBalanceMinor: number;
  /** True for a person on the roster (an admin who is not is only shown the balance). */
  canContribute: boolean;
  /** Present when the viewer manages the team **and** payouts are switched on. */
  payout: { candidates: PayoutCandidate[] } | null;
  recent: WalletTransactionRow[];
  /** First names for the `user:<id>` counterparties in `recent`. */
  names: Map<string, string | null>;
}) {
  const t = await getTranslations("teams.treasury");
  const tWallet = await getTranslations("wallet");

  return (
    <section className="regs-section pf-section" id="treasury" data-team-treasury={treasuryMinor}>
      <div className="section-label">
        <span className="iv-eyebrow">{t("title")}</span>
      </div>
      <h2 className="iv-title pf-h2">{t("heading")}</h2>

      <div className="wl-bal" data-live="true">
        <span className="wl-bal__asset">{t("balanceLabel")}</span>
        <span className="wl-bal__value" data-treasury-balance={treasuryMinor}>
          {formatWalletBalance(treasuryMinor, locale)}
        </span>
        <span className="wl-bal__note">{t("governance")}</span>
      </div>

      {canContribute ? (
        <div className="pf-block" id="treasury-contribute">
          <h3 className="iv-title pf-h2">{t("contributeHeading")}</h3>
          <TreasuryContributeForm slug={slug} balanceMinor={viewerBalanceMinor} locale={locale} />
        </div>
      ) : null}

      {payout && payout.candidates.length > 0 ? (
        <div className="pf-block" id="treasury-payout">
          <h3 className="iv-title pf-h2">{t("payoutHeading")}</h3>
          <p className="pf-block__sub">{t("payoutHint")}</p>
          <TreasuryPayoutForm
            slug={slug}
            treasuryMinor={treasuryMinor}
            candidates={payout.candidates}
            locale={locale}
          />
        </div>
      ) : null}

      <div className="pf-block" id="treasury-recent">
        <h3 className="iv-title pf-h2">{t("recentHeading")}</h3>
        {recent.length === 0 ? (
          <p className="pf-block__sub" data-treasury-empty="1">
            {t("empty")}
          </p>
        ) : (
          <ul className="wl-tx-list">
            {recent.map((tx) => {
              const who = counterpartyLine(tx, names, (key, values) => t(key, values));
              return (
                <li className="wl-tx" key={tx.id} data-treasury-row={tx.kind}>
                  <div className="wl-tx__main">
                    <span className="wl-tx__purpose">{tWallet(`kinds.${tx.kind}`)}</span>
                    {who ? <span className="wl-tx__memo">{who}</span> : null}
                    <span className="wl-tx__meta">
                      <time dateTime={tx.createdAt.toISOString()}>
                        {formatWalletDateTime(tx.createdAt, locale)}
                      </time>
                    </span>
                  </div>
                  <div className="wl-tx__side">
                    <span className="wl-tx__amount" data-dir={tx.amountMinor < 0 ? "out" : "in"}>
                      {formatWalletAmount(tx.amountMinor, locale)}
                      <span className="wl-tx__asset">{tWallet(`assets.${tx.asset}`)}</span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="iv-actions">
          <Link href={`/teams/${slug}/treasury`} className="btn btn-stroke-dark btn-sm">
            {t("history")}
          </Link>
        </div>
      </div>
    </section>
  );
}
