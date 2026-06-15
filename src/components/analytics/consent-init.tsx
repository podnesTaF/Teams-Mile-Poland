import Script from "next/script";

import { GTM_ID } from "./gtm";

/**
 * Google Consent Mode v2 bootstrap. Must run *before* the GTM loader so the
 * default consent state is on the dataLayer when tags evaluate.
 *
 * Everything non-essential (analytics + ad storage) defaults to `denied`.
 * If the visitor already accepted on a previous visit, the `tm_cookie_consent`
 * cookie is `granted`, so we start granted and skip re-prompting. The
 * `CookieConsent` banner flips this at runtime via `gtag('consent','update')`.
 *
 * `strategy="beforeInteractive"` only takes effect in the root layout, which
 * is where this is rendered.
 */
export function GoogleConsentInit() {
  if (!GTM_ID) return null;
  return (
    <Script
      id="gtm-consent-default"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{
        __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
var granted = document.cookie.indexOf('tm_cookie_consent=granted') !== -1;
var state = granted ? 'granted' : 'denied';
gtag('consent', 'default', {
  ad_storage: state,
  ad_user_data: state,
  ad_personalization: state,
  analytics_storage: state,
  functionality_storage: 'granted',
  security_storage: 'granted',
  wait_for_update: 500
});`,
      }}
    />
  );
}
