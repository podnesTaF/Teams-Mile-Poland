import { useTranslations } from "next-intl";

import { AuthNav } from "@/features/auth/components/auth-nav";
import { Link } from "@/i18n/navigation";

import { LangPill } from "./lang-pill";
import { Wordmark } from "./wordmark";

/**
 * Slim dark header for interior pages (team dashboard, access, success,
 * ticket) so they share the landing's ACE BATTLE look instead of the old
 * marketing header. Logo links home; gallery, auth and the language pill on
 * the right. `useTranslations` is fine here — this is a server component and
 * next-intl resolves it synchronously from the request's messages.
 */
export function InteriorHeader() {
  const t = useTranslations("landing.header");
  return (
    <header className="iv-header">
      <div className="iv-header__inner">
        <Link href="/" className="iv-header__brand" aria-label="ACE BATTLE — home">
          <Wordmark variant="nav" />
        </Link>
        <div className="iv-header__right">
          <Link href="/gallery" className="iv-header__auth iv-header__nav-link">
            {t("nav.gallery")}
          </Link>
          <AuthNav />
          <LangPill />
        </div>
      </div>
    </header>
  );
}
