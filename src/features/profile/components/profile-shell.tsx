"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Flag, Settings, Timer, UserPlus, Users, Wallet, type LucideIcon } from "lucide-react";

import { Link } from "@/i18n/navigation";

import { ProfileHashTab } from "./profile-hash-tab";

export type ProfileTabKey = "races" | "results" | "teams" | "invite" | "settings";

export type ProfileTabItem = {
  key: ProfileTabKey;
  href: string;
  label: string;
  /**
   * Set when something on this tab is waiting for the runner (an attendance to
   * confirm, an unfinished profile) — drawn as a red dot, read out as this text.
   */
  attention?: string;
};

const ICONS: Record<ProfileTabKey, LucideIcon> = {
  races: Flag,
  results: Timer,
  teams: Users,
  invite: UserPlus,
  settings: Settings,
};

/**
 * The profile's navigation and content column — the admin pattern, one element
 * with two behaviours, so there is no second copy of the nav to keep in sync:
 *
 * - **desktop** (≥ 960px): a sticky left rail — who is signed in, the sections
 *   with icons, the wallet with its balance, sign-out;
 * - **phone**: a sticky strip of tabs directly under the site header, scrolling
 *   sideways, with the active tab kept in view.
 *
 * Tabs are `?tab=` links rendered by the server page; this component only adds
 * what a server cannot: the pressed tab highlights at once and the old content
 * dims while the new tab is rendering, so a tap never looks ignored.
 */
export function ProfileShell({
  tabs,
  active,
  navLabel,
  identity,
  wallet,
  footer,
  children,
}: {
  tabs: ProfileTabItem[];
  active: ProfileTabKey;
  navLabel: string;
  /** Avatar, name and email — shown at the top of the rail on desktop only. */
  identity: ReactNode;
  wallet: { href: string; label: string; value: string };
  /** Sign-out — the rail's last row on desktop (the phone hero carries its own). */
  footer: ReactNode;
  children: ReactNode;
}) {
  // The tab pressed but not yet rendered. Keyed to the tab that was active at
  // the time, so it lapses by itself the moment the server answers.
  const [pending, setPending] = useState<{ from: ProfileTabKey; to: ProfileTabKey } | null>(null);
  const shown = pending && pending.from === active ? pending.to : active;
  const busy = shown !== active;

  // Phone strip: keep the active tab visible (a deep link to "Settings" would
  // otherwise open with that tab scrolled off to the right).
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    const current = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !current || list.scrollWidth <= list.clientWidth) return;
    const target = current.offsetLeft - (list.clientWidth - current.offsetWidth) / 2;
    list.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [shown]);

  // The strip and rail stick just below the site header, whose height is not a
  // constant (its links wrap on narrow phones) — so it is measured, not guessed.
  const shellRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".iv-header");
    const shell = shellRef.current;
    if (!header || !shell) return;
    const sync = () => shell.style.setProperty("--pf-top", `${header.offsetHeight}px`);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="iv-wrap pf-shell" ref={shellRef}>
      <ProfileHashTab />
      <aside className="pf-side">
        <div className="pf-side__id">{identity}</div>

        <nav aria-label={navLabel}>
          <ul className="pf-tabs" ref={listRef}>
            {tabs.map((tab) => {
              const Icon = ICONS[tab.key];
              const isCurrent = tab.key === shown;
              return (
                <li key={tab.key}>
                  <Link
                    className="pf-tab"
                    href={tab.href}
                    // The rail and strip are sticky; jumping to the top would
                    // only re-show the hero above the content that changed.
                    scroll={false}
                    data-profile-tab={tab.key}
                    aria-current={isCurrent ? "page" : undefined}
                    onClick={(event) => {
                      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
                        return;
                      }
                      if (tab.key !== active) setPending({ from: active, to: tab.key });
                    }}
                  >
                    <Icon className="pf-tab__ic" aria-hidden />
                    <span className="pf-tab__label">{tab.label}</span>
                    {tab.attention ? (
                      <span
                        className="pf-tab__dot"
                        role="img"
                        aria-label={tab.attention}
                        title={tab.attention}
                      />
                    ) : null}
                  </Link>
                </li>
              );
            })}
            <li className="pf-tabs__wallet">
              <Link className="pf-tab pf-tab--wallet" href={wallet.href}>
                <Wallet className="pf-tab__ic" aria-hidden />
                <span className="pf-tab__label">{wallet.label}</span>
                <span className="pf-tab__value">{wallet.value}</span>
              </Link>
            </li>
          </ul>
        </nav>

        <div className="pf-side__foot">{footer}</div>
      </aside>

      <div
        className="pf-content"
        aria-busy={busy || undefined}
        data-busy={busy ? "true" : undefined}
      >
        {children}
      </div>
    </div>
  );
}
