import { Link } from "@/i18n/navigation";

import { LangPill } from "./lang-pill";
import { Wordmark } from "./wordmark";

/**
 * Slim dark header for interior pages (team dashboard, access, success,
 * ticket) so they share the landing's ACE BATTLE look instead of the old
 * marketing header. Logo links home; language pill on the right.
 */
export function InteriorHeader() {
  return (
    <header className="iv-header">
      <div className="iv-header__inner">
        <Link href="/" className="iv-header__brand" aria-label="ACE BATTLE — home">
          <Wordmark variant="nav" />
        </Link>
        <LangPill />
      </div>
    </header>
  );
}
