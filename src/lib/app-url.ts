/**
 * Canonical public origin for absolute links (emails, Stripe callbacks,
 * Better Auth baseURL, post-magic-link redirects).
 *
 * Emails are the reason this is pinned rather than merely configured. Every
 * link we mail — verification, password reset, ticket, magic link, invite,
 * unsubscribe, gallery — is built from {@link getAppUrl}, and a mailed link
 * cannot be corrected after the fact. So a `*.vercel.app` value in the
 * environment (Vercel's own deployment host, or a `NEXT_PUBLIC_APP_URL` set
 * before the custom domain was attached) is treated as unusable and falls
 * through to {@link CANONICAL_APP_URL}; the same goes for the env being unset
 * in a deployed build, which would otherwise mail `http://localhost:3000`.
 *
 * A custom domain in `NEXT_PUBLIC_APP_URL` (or `BETTER_AUTH_URL`) still wins,
 * so renaming the site stays an env change — it just cannot silently degrade
 * to a platform default.
 */
export const CANONICAL_APP_URL = "https://poland.acebattle.run";

/** Vercel deployment hosts, which must never end up in a mailed link. */
const PLATFORM_HOST = /\.vercel\.(app|sh)$/i;

/**
 * First configured origin that is a real public domain, or `undefined`.
 *
 * `NEXT_PUBLIC_APP_URL` is checked first: `BETTER_AUTH_URL` exists to point
 * Better Auth at its own host and is the likelier of the two to be left on a
 * deployment URL.
 */
function configuredAppUrl(): string | undefined {
  for (const raw of [process.env.NEXT_PUBLIC_APP_URL, process.env.BETTER_AUTH_URL]) {
    const value = raw?.trim().replace(/\/+$/, "");
    if (!value) continue;

    let host: string;
    try {
      host = new URL(value).host;
    } catch {
      continue; // unparseable — no better than unset
    }

    if (PLATFORM_HOST.test(host)) continue;
    return value;
  }

  return undefined;
}

export function getAppUrl(): string {
  return (
    configuredAppUrl() ??
    (process.env.NODE_ENV === "production" ? CANONICAL_APP_URL : "http://localhost:3000")
  );
}

/**
 * This deployment's own Vercel hosts (`https://` origins, no trailing slash).
 *
 * Pinning `getAppUrl()` to the custom domain also pins Better Auth's default
 * trusted origin to it, which would reject every sign-in POST made from a
 * preview deployment or from the production deployment's `*.vercel.app`
 * alias. These origins go into `trustedOrigins` to keep those reachable —
 * they are Vercel's per-deployment injections for this project only, not a
 * `*.vercel.app` wildcard.
 */
export function vercelDeploymentOrigins(): string[] {
  return [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]
    .map((host) => host?.trim().replace(/^https?:\/\//, "").replace(/\/+$/, ""))
    .filter((host): host is string => Boolean(host))
    .map((host) => `https://${host}`);
}

/** Absolute URL under {@link getAppUrl}. `path` should be root-relative. */
export function appAbsoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getAppUrl()}${normalized}`;
}
