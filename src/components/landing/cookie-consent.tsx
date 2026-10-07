"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import "@/app/landing.css";

import { Link } from "@/i18n/navigation";
import { readConsent, setConsent, type ConsentChoice } from "@/lib/consent";

/**
 * Cookie-consent banner, rendered once in the locale layout so it shows on
 * every page — not just the landing. A visitor who arrives straight on an
 * event, news or team page (ads, shared links) must be able to opt in, or
 * Consent Mode keeps analytics denied for their whole visit.
 *
 * Its styles live in `landing.css` under `.ace-landing`, so the banner brings
 * its own `.ace-landing` wrapper (`cookie-consent-root` strips the landing
 * root's background/overflow — the banner itself is `position: fixed`).
 *
 * Shown only until the visitor makes a choice (stored in the
 * `tm_cookie_consent` cookie). Accepting/rejecting calls `setConsent`, which
 * persists the choice and updates Google Consent Mode so GTM reacts without a
 * reload. We read the cookie in an effect (not during render) so the markup
 * matches the server and there's no hydration mismatch.
 */
export function CookieConsent() {
  const t = useTranslations("cookies");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (readConsent() === null) setOpen(true);
  }, []);

  function choose(choice: ConsentChoice) {
    setConsent(choice);
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="ace-landing cookie-consent-root">
      <div className="cookie-consent" role="dialog" aria-label={t("title")} aria-live="polite">
        <div className="cookie-consent__inner">
          <div className="cookie-consent__copy">
            <p className="cookie-consent__title">{t("title")}</p>
            <p className="cookie-consent__text">
              {t("text")}{" "}
              <Link href="/terms" target="_blank" rel="noopener noreferrer">
                {t("policy")}
              </Link>
            </p>
          </div>
          <div className="cookie-consent__actions">
            <button type="button" className="btn btn-stroke-dark" onClick={() => choose("denied")}>
              {t("reject")}
            </button>
            <button type="button" className="btn btn-red" onClick={() => choose("granted")}>
              {t("accept")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
