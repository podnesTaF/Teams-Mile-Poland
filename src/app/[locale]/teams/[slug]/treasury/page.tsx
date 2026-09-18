import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "@/app/series-flows.css";
import "@/app/[locale]/wallet/wallet.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { counterpartyLine, userIdFromReference } from "@/features/teams/components/team-treasury";
import { getManagerFirstNames, getTeamBySlug, getTeamMembership } from "@/features/teams/data";
import { WalletReference } from "@/features/wallet/components/team-reference";
import {
  getTeamAcerBalance,
  listWalletTransactions,
  parseWalletPage,
} from "@/features/wallet/data";
import {
  formatWalletAmount,
  formatWalletBalance,
  formatWalletDateTime,
} from "@/features/wallet/format";
import { Link } from "@/i18n/navigation";
import { getUser, userCan } from "@/lib/auth/user-session";

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

/** Money on the page; never served from a cache. Same stance as `/wallet`. */
export const dynamic = "force-dynamic";

/**
 * The team treasury's full history (ADR 0012) — every movement, newest first,
 * paged like the runner's own wallet history.
 *
 * Gated exactly as the team page gates its roster: a person on the roster or an
 * admin holding `view`. Anyone else gets `notFound()` rather than a refusal, so
 * the URL confirms nothing about a team they are not on. Counterparties are
 * first names; the ids in `user:<id>` references never reach the page.
 */
export default async function TeamTreasuryPage({ params, searchParams }: PageProps) {
  const { locale, slug } = await params;
  const { page } = await searchParams;
  setRequestLocale(locale);

  const team = await getTeamBySlug(slug);
  if (!team) notFound();

  const user = await getUser();
  const membership = user ? await getTeamMembership(team.id, user.id) : null;
  if (!membership && !userCan(user, "view")) notFound();

  const t = await getTranslations("teams.treasury");
  const tWallet = await getTranslations("wallet");

  const [treasuryMinor, history] = await Promise.all([
    getTeamAcerBalance(team.id),
    listWalletTransactions({ teamId: team.id }, { page: parseWalletPage(page) }),
  ]);
  const names = await getManagerFirstNames(
    history.rows
      .map((row) => userIdFromReference(row.reference))
      .filter((id): id is string => !!id),
  );

  const path = `/teams/${team.slug}/treasury`;

  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap">
          <Link href={`/teams/${team.slug}`} className="detail-back">
            ← {t("backToTeam")}
          </Link>
          <span className="iv-eyebrow">{t("title")}</span>
          <h1 className="iv-title">{t("historyHeading", { team: team.name })}</h1>

          <section className="wl-balances" aria-label={t("balanceLabel")}>
            <div className="wl-bal" data-live="true">
              <span className="wl-bal__asset">{t("balanceLabel")}</span>
              <span className="wl-bal__value" data-treasury-balance={treasuryMinor}>
                {formatWalletBalance(treasuryMinor, locale)}
              </span>
              <span className="wl-bal__note">{t("governance")}</span>
            </div>
          </section>

          <section className="wl-history" data-treasury-history={history.total}>
            {history.total === 0 ? (
              <div className="wl-empty">
                <p className="wl-empty__title">{t("empty")}</p>
              </div>
            ) : (
              <>
                <ul className="wl-tx-list">
                  {history.rows.map((tx) => {
                    const who = counterpartyLine(tx, names, (key, values) => t(key, values));
                    return (
                      <li className="wl-tx" key={tx.id} data-treasury-row={tx.kind}>
                        <div className="wl-tx__main">
                          <span className="wl-tx__purpose">{tWallet(`kinds.${tx.kind}`)}</span>
                          {who ? <span className="wl-tx__memo">{who}</span> : null}
                          {tx.memo ? <span className="wl-tx__memo">{tx.memo}</span> : null}
                          <span className="wl-tx__meta">
                            <time dateTime={tx.createdAt.toISOString()}>
                              {formatWalletDateTime(tx.createdAt, locale)}
                            </time>
                            <span className="wl-tx__id">
                              {tWallet("history.txid")} {tx.id}
                            </span>
                            <WalletReference
                              reference={tx.reference}
                              teamOnly
                              className="wl-tx__id"
                            />
                          </span>
                        </div>
                        <div className="wl-tx__side">
                          <span
                            className="wl-tx__amount"
                            data-dir={tx.amountMinor < 0 ? "out" : "in"}
                          >
                            {formatWalletAmount(tx.amountMinor, locale)}
                            <span className="wl-tx__asset">{tWallet(`assets.${tx.asset}`)}</span>
                          </span>
                          <span className={`wl-pill wl-pill--${tx.status}`}>
                            {tWallet(`statuses.${tx.status}`)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {history.pageCount > 1 ? (
                  <nav className="wl-pager" aria-label={tWallet("history.pagerLabel")}>
                    {history.page > 1 ? (
                      <Link
                        className="btn btn-stroke-dark btn-sm"
                        href={`${path}?page=${history.page - 1}`}
                      >
                        ← {tWallet("history.prev")}
                      </Link>
                    ) : (
                      <span />
                    )}
                    <span className="wl-pager__at">
                      {tWallet("history.pageOf", { page: history.page, pages: history.pageCount })}
                    </span>
                    {history.page < history.pageCount ? (
                      <Link
                        className="btn btn-stroke-dark btn-sm"
                        href={`${path}?page=${history.page + 1}`}
                      >
                        {tWallet("history.next")} →
                      </Link>
                    ) : (
                      <span />
                    )}
                  </nav>
                ) : null}
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
