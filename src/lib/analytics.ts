/**
 * Lightweight dataLayer helpers for Google Tag Manager.
 *
 * GTM itself is loaded by <GoogleTagManager /> (see components/analytics/gtm).
 * Marketing wires up tags/triggers in the GTM UI; the app's only contract is
 * to push a `form_submit` event whenever a form is successfully submitted,
 * carrying a `form_name` (and any extra context) so GTM can hook each form.
 */

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export function pushDataLayer(payload: Record<string, unknown> & { event: string }) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(payload);
}

/**
 * Standard form-submission event. `formName` identifies which form fired
 * (e.g. "registration_team", "contact"); `extra` adds optional context.
 */
export function trackFormSubmit(formName: string, extra?: Record<string, unknown>) {
  pushDataLayer({ event: "form_submit", form_name: formName, ...extra });
}
