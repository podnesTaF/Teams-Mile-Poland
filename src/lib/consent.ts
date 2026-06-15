/**
 * Cookie-consent helpers (client-side).
 *
 * We run Google Tag Manager with Consent Mode v2: the loader fires on every
 * page, but all non-essential storage (analytics + ads) defaults to `denied`
 * until the visitor accepts. The default is set inline before GTM in
 * `components/analytics/consent-init.tsx`; this module records the visitor's
 * choice and pushes the `consent` update so tags can start storing data.
 */

/** First-party cookie that remembers the visitor's choice across visits. */
export const CONSENT_COOKIE = "tm_cookie_consent";

/** One year — long enough that returning visitors aren't re-prompted. */
const CONSENT_MAX_AGE = 60 * 60 * 24 * 365;

export type ConsentChoice = "granted" | "denied";

declare global {
  interface Window {
    // gtag is defined by the inline consent-init script.
    gtag?: (...args: unknown[]) => void;
  }
}

/** Read the stored choice, or `null` when the visitor hasn't decided yet. */
export function readConsent(): ConsentChoice | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${CONSENT_COOKIE}=(granted|denied)`),
  );
  return (match?.[1] as ConsentChoice | undefined) ?? null;
}

/**
 * Persist the choice and push it to Consent Mode so GTM tags react
 * immediately (no reload needed). `granted` unlocks analytics + ads storage;
 * `denied` keeps everything but strictly-necessary storage off.
 */
export function setConsent(choice: ConsentChoice): void {
  if (typeof document !== "undefined") {
    document.cookie = `${CONSENT_COOKIE}=${choice}; path=/; max-age=${CONSENT_MAX_AGE}; samesite=lax`;
  }

  const state = choice === "granted" ? "granted" : "denied";
  window.gtag?.("consent", "update", {
    ad_storage: state,
    ad_user_data: state,
    ad_personalization: state,
    analytics_storage: state,
  });
}
