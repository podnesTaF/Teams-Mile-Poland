/**
 * Lightweight dataLayer helpers for Google Tag Manager.
 *
 * GTM itself is loaded by <GoogleTagManager /> (see components/analytics/gtm).
 * Marketing wires up tags/triggers in the GTM UI; the app's contract is two
 * custom events: `form_submit` (with `form_name`) whenever a form succeeds,
 * and `link_click` (with `link_name`) for the clicks marketing counts.
 *
 * `form_name` values: registration_solo / registration_team /
 * registration_join (legacy /register modal), registration_event (per-event
 * registration, `mode` account|guest), sign_up, sign_in, team_create,
 * team_entry, team_join, contact.
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

/**
 * `trackFormSubmit` for a submit that leaves the page right after (Stripe
 * Checkout, the signed ticket): a push followed by a hard navigation can be
 * lost before GTM's tags send. `next` runs once GTM reports its tags fired
 * (`eventCallback`), or after a short timeout when GTM is absent, blocked or
 * slow — so the runner is never stranded on the form.
 */
export function trackFormSubmitThen(
  formName: string,
  extra: Record<string, unknown> | undefined,
  next: () => void,
) {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    next();
  };
  pushDataLayer({
    event: "form_submit",
    form_name: formName,
    ...extra,
    eventCallback: finish,
    eventTimeout: 800,
  });
  setTimeout(finish, 1000);
}

/**
 * Click event for the action links/buttons marketing cares about — the
 * group (WhatsApp/Telegram) joins, phone/email links, link-copy buttons, and
 * the entry points into registration. `linkName` identifies which one fired
 * (e.g. "footer_whatsapp", "event_register_cta"); `extra` adds context.
 *
 * A custom `link_click` event, not GTM's reserved `gtm.linkClick`, so these
 * don't collide with GTM's built-in Just Links triggers. In GTM, hook them
 * with a Custom Event trigger on `link_click`.
 */
export function trackLinkClick(linkName: string, extra?: Record<string, unknown>) {
  pushDataLayer({ event: "link_click", link_name: linkName, ...extra });
}
