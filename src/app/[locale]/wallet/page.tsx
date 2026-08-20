import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "@/app/series-flows.css";
import "./wallet.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { WALLET_ASSETS } from "@/db/schema";
import { getWalletBalances, listWalletTransactions, parseWalletPage } from "@/features/wallet/data";
import {
  formatWalletAmount,
  formatWalletBalance,
  formatWalletDateTime,
} from "@/features/wallet/format";
import { Link } from "@/i18n/navigation";
import { getUser, isProfileComplete } from "@/lib/auth/user-session";
import { localePath } from "@/lib/i18n/config";

/**
 * Per-user money: nothing here can be pre-rendered, and a cached balance is
 * worse than a slow one. Excluded from static generation for the same reason
 * the results page is (`node_modules/next/dist/docs` — route segment config,
 * `dynamic: 'force-dynamic'`).
 */
export const dynamic = "force-dynamic";

/** The path the gate chain returns to, threaded through every hop. */
const WALLET_PATH = "/wallet";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "wallet" });
  return { title: t("meta.title") };
}

/**
 * The cabinet wallet: the three ecosystem balances and the full transaction
 * history (ТЗ 2.6.4.2 — date-time, TxID, asset, signed amount, purpose,
 * status).
 *
 * ACER is prepaid platform credit, earned at check-in and (later) bought by
 * card. It is not withdrawable and there is deliberately no withdrawal
 * affordance or mention anywhere on this page — the product is credit, and the
 * copy says only what it legally is.
 *
 * Ace(PL) and ACEG are shown read-only at zero: no rule issues them yet, and
 * displaying the full asset set is more honest than hiding two thirds of the
 * ecosystem until it exists.
 */
export default async function WalletPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { page } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations("wallet");

  // Gate chain, `redirectTo` threaded through every hop: a guest signs up (or
  // follows the form's link to sign-in), verifies, completes the profile, and
  // each step hands the next one this page as the destination — so the round
  // trip ends where the intent started.
  const user = await getUser();
  if (!user) {
    redirect(localePath(locale, `/auth/sign-up?redirectTo=${encodeURIComponent(WALLET_PATH)}`));
  }

  if (!user.emailVerified) {
    return (
      <GateNotice
        title={t("gate.verifyTitle")}
        body={t("gate.verifyBody")}
        href={`/auth/verify-email?email=${encodeURIComponent(user.email)}&redirectTo=${encodeURIComponent(WALLET_PATH)}`}
        cta={t("gate.verifyCta")}
      />
    );
  }

  if (!isProfileComplete(user)) {
    return (
      <GateNotice
        title={t("gate.profileTitle")}
        body={t("gate.profileBody")}
        href={`/profile?redirectTo=${encodeURIComponent(WALLET_PATH)}`}
        cta={t("gate.profileCta")}
      />
    );
  }

  const [balances, history] = await Promise.all([
    getWalletBalances(user.id),
    listWalletTransactions(user.id, { page: parseWalletPage(page) }),
  ]);

  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap">
          <span className="iv-eyebrow">{t("eyebrow")}</span>
          <h1 className="iv-title">{t("title")}</h1>
          <p className="iv-sub">{t("subtitle")}</p>

          <section className="wl-balances" aria-label={t("balances.heading")}>
            {WALLET_ASSETS.map((asset) => (
              <div className="wl-bal" key={asset} data-live={asset === "ACER" ? "true" : undefined}>
                <span className="wl-bal__asset">{t(`assets.${asset}`)}</span>
                <span className="wl-bal__value">
                  {formatWalletBalance(balances[asset], locale)}
                </span>
                <span className="wl-bal__note">{t(`assetNote.${asset}`)}</span>
              </div>
            ))}
          </section>

          <section className="wl-history">
            <div className="section-label">
              <span className="iv-eyebrow">{t("history.title")}</span>
            </div>
            <h2 className="iv-title pf-h2">{t("history.heading")}</h2>

            {history.total === 0 ? (
              <div className="wl-empty">
                <p className="wl-empty__title">{t("history.empty")}</p>
                <p className="wl-empty__hint">{t("history.emptyHint")}</p>
              </div>
            ) : (
              <>
                <ul className="wl-tx-list">
                  {history.rows.map((tx) => (
                    <li className="wl-tx" key={tx.id}>
                      <div className="wl-tx__main">
                        <span className="wl-tx__purpose">{t(`kinds.${tx.kind}`)}</span>
                        {tx.memo ? <span className="wl-tx__memo">{tx.memo}</span> : null}
                        <span className="wl-tx__meta">
                          <time dateTime={tx.createdAt.toISOString()}>
                            {formatWalletDateTime(tx.createdAt, locale)}
                          </time>
                          <span className="wl-tx__id">
                            {t("history.txid")} {tx.id}
                          </span>
                        </span>
                      </div>
                      <div className="wl-tx__side">
                        <span
                          className="wl-tx__amount"
                          data-dir={tx.amountMinor < 0 ? "out" : "in"}
                        >
                          {formatWalletAmount(tx.amountMinor, locale)}
                          <span className="wl-tx__asset">{t(`assets.${tx.asset}`)}</span>
                        </span>
                        <span className={`wl-pill wl-pill--${tx.status}`}>
                          {t(`statuses.${tx.status}`)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>

                {history.pageCount > 1 ? (
                  <nav className="wl-pager" aria-label={t("history.pagerLabel")}>
                    {history.page > 1 ? (
                      <Link
                        className="btn btn-stroke-dark btn-sm"
                        href={`${WALLET_PATH}?page=${history.page - 1}`}
                      >
                        ← {t("history.prev")}
                      </Link>
                    ) : (
                      <span />
                    )}
                    <span className="wl-pager__at">
                      {t("history.pageOf", { page: history.page, pages: history.pageCount })}
                    </span>
                    {history.page < history.pageCount ? (
                      <Link
                        className="btn btn-stroke-dark btn-sm"
                        href={`${WALLET_PATH}?page=${history.page + 1}`}
                      >
                        {t("history.next")} →
                      </Link>
                    ) : (
                      <span />
                    )}
                  </nav>
                ) : null}
              </>
            )}
          </section>

          <div className="iv-actions wl-foot">
            <Link href="/profile" className="btn btn-stroke-dark">
              {t("backToProfile")}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * A step of the gate chain the user still has to finish. Rendered as the whole
 * page rather than beside the balances: an unverified or half-registered
 * account has nothing in its ledger, so a wall of zeros under a "finish this"
 * banner would just bury the one action that matters.
 */
function GateNotice({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap iv-wrap--narrow">
          <section className="iv-card center-narrow">
            <span className="iv-eyebrow">{title}</span>
            <p className="iv-sub">{body}</p>
            <div className="iv-actions">
              <Link href={href} className="btn btn-red">
                {cta}
              </Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
