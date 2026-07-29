/**
 * Canonical public origin for absolute links (emails, Stripe callbacks,
 * Better Auth baseURL, post-magic-link redirects).
 *
 * Prefer `NEXT_PUBLIC_APP_URL` (e.g. `https://poland.acebattle.run`) over
 * platform defaults — on Vercel, request hosts and `BETTER_AUTH_URL` often
 * still point at `*.vercel.app` after a custom domain is attached.
 */
export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

/** Absolute URL under {@link getAppUrl}. `path` should be root-relative. */
export function appAbsoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getAppUrl()}${normalized}`;
}
