"use client";

import { useEffect, useState, type ReactNode } from "react";

import { authClient } from "@/lib/auth/auth-client";

type Props = {
  /** Classes of the price box as the server rendered it (the night's price). */
  className: string;
  /** Classes of the price box once the viewer turns out to run free. */
  freeClassName: string;
  /** What the server rendered: the night's individual price, or "Free". */
  children: ReactNode;
  /** "Free", in the page's locale. */
  freeLabel: string;
  /**
   * "Team race · {team} — free for you", in the page's locale. The `{team}`
   * placeholder is filled here: a translated template with one hole crosses
   * the server/client line, a translator function cannot.
   */
  teamTemplate?: string;
};

/**
 * The entry price as *this* visitor will pay it (ADR 0016). The event page is
 * static, so it prints the night's individual price for everyone; a member of
 * RED or BLACK registers for the team race free, and showing them "25 zł" next
 * to a Register button is a lie printed in three languages. Once the session
 * is known, the island asks `/api/me/race` and, for a member, swaps the price
 * for "Free" and names the team. Everyone else — signed out, not a member, or
 * while the answer is in flight — sees exactly what the server rendered.
 *
 * Display only. The register page derives the race again on the server when
 * the row is written, so this can never change what anyone is charged.
 */
export function EntryPriceForViewer({
  className,
  freeClassName,
  children,
  freeLabel,
  teamTemplate,
}: Props) {
  const { data } = authClient.useSession();
  const userId = data?.user?.id ?? null;
  // The answer is remembered with the user it was fetched for, so a sign-out
  // (or a switch of account) falls back to the server-rendered price without
  // a state write inside the effect — the effect only ever sets state from
  // the fetch callback.
  const [answer, setAnswer] = useState<{ userId: string; team: string | null } | null>(null);
  const team = answer && answer.userId === userId ? answer.team : null;

  useEffect(() => {
    if (!userId) return;
    let live = true;
    fetch("/api/me/race", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { team?: { label?: string } | null } | null) => {
        if (live) setAnswer({ userId, team: json?.team?.label ?? null });
      })
      .catch(() => {
        /* The server-rendered price stays; nothing to recover from. */
      });
    return () => {
      live = false;
    };
  }, [userId]);

  if (!team) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={freeClassName} data-viewer-race="team" data-viewer-team={team}>
      {freeLabel}
      {teamTemplate ? (
        <small className="slots-val__sub">{teamTemplate.replace("{team}", team)}</small>
      ) : null}
    </div>
  );
}
