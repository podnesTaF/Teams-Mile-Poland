"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { LogOutButton } from "@/features/auth/components/log-out-button";
import { cn } from "@/lib/utils";

import { MenuIcon } from "./icons";
import { LangPill } from "./lang-pill";
import { Wordmark } from "./wordmark";

const NAV_LINKS = [
  { key: "whatIs", href: "#what-is" },
  { key: "howItGoes", href: "#how-it-goes" },
  { key: "audience", href: "#audience" },
  // { key: "program", href: "#program" },
  { key: "location", href: "#location" },
  { key: "faq", href: "#faq" },
] as const;

/**
 * Fixed white landing header — hidden at the very top, then reveals on scroll
 * up and hides on scroll down. Force-hidden while a prize-table modal is open
 * (the modal broadcasts an `ace:modal` event).
 */
export function LandingHeader({
  registrationOpen = false,
  registerHref = "/register",
}: {
  registrationOpen?: boolean;
  registerHref?: string;
}) {
  const t = useTranslations("landing.header");
  const tAuth = useTranslations("auth");
  const { data: session, isPending: authPending } = authClient.useSession();
  const authHref = session ? "/profile" : "/auth/sign-in";
  const authLabel = session ? tAuth("nav.profile") : tAuth("nav.signIn");
  const [menuOpen, setMenuOpen] = useState(false);
  const [shownByScroll, setShownByScroll] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const visible = (shownByScroll || menuOpen) && !modalOpen;

  useEffect(() => {
    const threshold = 80;
    const delta = 6;
    let lastY = window.scrollY;
    let ticking = false;
    const update = () => {
      const y = window.scrollY;
      if (y <= threshold) {
        setShownByScroll(false); // near the top, stay hidden over the hero
      } else if (y > lastY + delta) {
        setShownByScroll(false); // scrolling down → hide
      } else if (y < lastY - delta) {
        setShownByScroll(true); // scrolling up → reveal
      }
      lastY = y;
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onModal = (e: Event) => setModalOpen(Boolean((e as CustomEvent).detail));
    window.addEventListener("ace:modal", onModal);
    return () => window.removeEventListener("ace:modal", onModal);
  }, []);

  useEffect(() => {
    if (!visible) setMenuOpen(false);
  }, [visible]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeMenu]);

  return (
    <header
      className={cn("site-header", visible && "is-visible", menuOpen && "is-open")}
      aria-hidden={!visible}
    >
      <div className="site-header__bar">
        <div className="site-header__inner">
          <Link href="/" className="site-header__brand" aria-label="ACE BATTLE — home">
            <Wordmark variant="header" />
          </Link>

          <nav className="site-header__nav" aria-label={t("navLabel")}>
            {NAV_LINKS.map(({ key, href }) => (
              <a key={key} href={href} className="site-header__link">
                {t(`nav.${key}`)}
              </a>
            ))}
          </nav>

          <div className="site-header__actions">
            {!authPending ? (
              <>
                <Link href={authHref} className="site-header__link site-header__auth">
                  {authLabel}
                </Link>
                {session ? <LogOutButton className="site-header__link" /> : null}
              </>
            ) : null}
            <LangPill tone="dark" />
            {registrationOpen ? (
              <Link href={registerHref} className="btn btn-red btn-sm site-header__cta">
                {t("cta")}
              </Link>
            ) : (
              <a href="#results" className="btn btn-red btn-sm site-header__cta">
                {t("ctaResults")}
              </a>
            )}
            <button
              type="button"
              className="site-header__menu-btn"
              aria-expanded={menuOpen}
              aria-controls="site-header-drawer"
              aria-label={menuOpen ? t("menuClose") : t("menuOpen")}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MenuIcon open={menuOpen} />
            </button>
          </div>
        </div>
      </div>

      <div
        id="site-header-drawer"
        className="site-header__drawer"
        hidden={!menuOpen}
        aria-hidden={!menuOpen}
      >
        <nav className="site-header__drawer-nav" aria-label={t("navLabel")}>
          {NAV_LINKS.map(({ key, href }) => (
            <a key={key} href={href} className="site-header__drawer-link" onClick={closeMenu}>
              {t(`nav.${key}`)}
            </a>
          ))}
        </nav>
        <div className="site-header__drawer-actions">
          {!authPending ? (
            <>
              <Link href={authHref} className="site-header__drawer-link" onClick={closeMenu}>
                {authLabel}
              </Link>
              {session ? <LogOutButton className="site-header__drawer-link" /> : null}
            </>
          ) : null}
          <LangPill tone="dark" />
          {registrationOpen ? (
            <Link href={registerHref} className="btn btn-red site-header__cta" onClick={closeMenu}>
              {t("cta")}
            </Link>
          ) : (
            <a href="#results" className="btn btn-red site-header__cta" onClick={closeMenu}>
              {t("ctaResults")}
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
