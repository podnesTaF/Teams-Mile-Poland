"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * The profile used to be one long page of `#anchor` sections; it is tabs
 * (`?tab=`) now. Links into the old anchors still exist in mail already sent
 * (`/profile#teams` from the join-request emails), and the fragment never
 * reaches the server — so this translates it in the browser, once, into the
 * tab it meant. A URL that already names a tab is left alone.
 */
const HASH_TO_TAB: Record<string, string> = {
  registrations: "races",
  results: "results",
  teams: "teams",
  referrals: "invite",
  settings: "settings",
};

export function ProfileHashTab() {
  const router = useRouter();

  useEffect(() => {
    const tab = HASH_TO_TAB[window.location.hash.slice(1)];
    if (!tab) return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("tab")) return;
    url.searchParams.set("tab", tab);
    url.hash = "";
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }, [router]);

  return null;
}
