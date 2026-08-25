import type { WalletAsset, WalletTxKind, WalletTxStatus } from "@/db/schema";

/**
 * How the admin panel says the ledger's three value sets.
 *
 * The runner's own history says the same things from the `wallet` namespace in
 * pl/en/ua; the panel is **English-only by repo convention**, so it words itself
 * here rather than forcing a locale on next-intl. The wording is deliberately
 * kept in step with the catalog's English — an admin and the runner they are
 * helping should be reading the same names for the same row.
 */

export const WALLET_ASSET_LABEL: Record<WalletAsset, string> = {
  ACER: "ACER",
  ACE_PL: "Ace(PL)",
  ACEG: "ACEG",
};

export const WALLET_KIND_LABEL: Record<WalletTxKind, string> = {
  participation_reward: "Race participation reward",
  prize_reward: "Prize reward",
  referral_signup: "Invitation reward",
  referral_ticket: "Invitation entry income",
  referral_sponsor: "Sponsor introduction reward",
  purchase: "Credit purchase",
  admin_credit: "Manual credit",
  admin_debit: "Manual debit",
  reversal: "Correction",
};

export const WALLET_STATUS_LABEL: Record<WalletTxStatus, string> = {
  completed: "Completed",
  pending: "Pending",
  failed: "Failed",
};
