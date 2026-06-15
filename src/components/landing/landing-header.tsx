"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { MenuIcon } from "./icons";
import { LangPill } from "./lang-pill";
import { Wordmark } from "./wordmark";

const NAV_LINKS = [
  { key: "whatIs", href: "#what-is" },
  { key: "howItGoes", href: "#how-it-goes" },
  { key: "audience", href: "#audience" },
  { key: "program", href: "#program" },
  { key: "location", href: "#location" },
  { key: "faq", href: "#faq" },
] as const;

/** Fixed white landing header — hidden at top; slides in after scroll. */
export function LandingHeader() {
  const t = useTranslations("landing.header");
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const visible = scrolled || menuOpen;

  useEffect(() => {
    const threshold = 80;
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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
            <LangPill tone="dark" />
            <Link href="/register" className="btn btn-red btn-sm site-header__cta">
              {t("cta")}
            </Link>
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
          <LangPill tone="dark" />
          <Link href="/register" className="btn btn-red site-header__cta" onClick={closeMenu}>
            {t("cta")}
          </Link>
        </div>
      </div>
    </header>
  );
}
