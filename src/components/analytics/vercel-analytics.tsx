"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

/**
 * Vercel Web Analytics. Cookieless, so it sits outside the Consent Mode
 * gate that GTM runs behind. Only reports on Vercel deployments; locally the
 * component logs to the console in development mode and sends nothing.
 *
 * `beforeSend` keeps secrets and staff traffic out of the reports:
 * - query strings carry reset/verify/unsubscribe tokens, so they are dropped;
 * - team invite links carry their token in the path, so it is masked;
 * - /admin pages are staff traffic and would skew visitor numbers.
 */
const SECRET_SEGMENT = /\/(teams\/invite)\/[^/]+/;

function beforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  const url = new URL(event.url);
  if (/^\/(?:[a-z]{2}\/)?admin(?:\/|$)/.test(url.pathname)) return null;
  url.search = "";
  url.pathname = url.pathname.replace(SECRET_SEGMENT, "/$1/[token]");
  return { ...event, url: url.toString() };
}

export function VercelAnalytics() {
  return <Analytics beforeSend={beforeSend} />;
}
