import { Link } from "@/i18n/navigation";

/**
 * The `team:<slug>` reference a team-creation debit carries, rendered as a link
 * to the team it paid for.
 *
 * A ledger row's `reference` is the handle that answers "what was this 100
 * for", and for this one kind the answer is a page. Shared by the runner's
 * wallet history and the admin panel's ledger so the two cannot disagree about
 * which references are clickable — parsing the prefix in two places is how they
 * would.
 */

/** The prefix a team-creation row's `reference` is built from (`createTeamRows`). */
const TEAM_PREFIX = "team:";

/**
 * The slug in a `team:<slug>` reference, or `null` for anything else.
 *
 * The shape is checked rather than trusted: `reference` is free text in the
 * schema, and a slug is the lowercase-alphanumeric-and-dash string `uniqueSlug`
 * produces. A row carrying something else must not become a link into a route
 * it was never about.
 */
export function teamSlugFromReference(reference: string | null | undefined): string | null {
  if (!reference || !reference.startsWith(TEAM_PREFIX)) return null;
  const slug = reference.slice(TEAM_PREFIX.length);
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null;
}

/**
 * A ledger row's reference: a link when it names a team, the plain string
 * otherwise, and nothing at all when `teamOnly` is set and it names no team —
 * which is how the runner's history shows only the references that mean
 * something to a runner while the admin ledger keeps showing all of them.
 */
export function WalletReference({
  reference,
  className,
  teamOnly = false,
}: {
  reference: string | null | undefined;
  className?: string;
  teamOnly?: boolean;
}) {
  const slug = teamSlugFromReference(reference);
  if (!slug) return teamOnly || !reference ? null : <>{reference}</>;
  return (
    <Link href={`/teams/${slug}`} className={className} data-wallet-team={slug}>
      {reference}
    </Link>
  );
}
