/**
 * Lightweight dataLayer helpers for Google Tag Manager.
 *
 * GTM itself is loaded by <GoogleTagManager /> (see components/analytics/gtm).
 * Marketing wires up tags/triggers in the GTM UI. The app's contract:
 * - `form_submit` with a `form_name` whenever a form is successfully submitted;
 * - `gtm.linkClick` with a `link_name` for the action links marketing tracks;
 * - GA4-named events (`sign_up`, `login`, `begin_checkout`, `purchase`, …)
 *   for the funnel, with GA4's own parameter names so a GA4 Event tag can
 *   forward them as-is;
 * - `funnel_blocked` with a `reason` when a gate sends someone away mid-flow.
 *
 * Never put an email, phone or name in a payload — GA forbids PII.
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
 * Click event for the action links/buttons marketing cares about — the
 * group (WhatsApp/Telegram) joins, phone/email links, and link-copy buttons
 * that sit after a form or in the footer. `linkName` identifies which one
 * fired (e.g. "footer_whatsapp", "success_copy_link"); `extra` adds context.
 *
 * Uses GTM's `gtm.linkClick` event name so marketing can hook these the same
 * way they hook GTM's built-in click triggers.
 */
export function trackLinkClick(linkName: string, extra?: Record<string, unknown>) {
  pushDataLayer({ event: "gtm.linkClick", link_name: linkName, ...extra });
}

/** Any GA4-style event: `trackEvent("sign_up", { method: "email" })`. */
export function trackEvent(name: string, params?: Record<string, unknown>) {
  pushDataLayer({ event: name, ...params });
}

/**
 * A gate sent the visitor away mid-flow (profile incomplete, email not
 * verified, signed out, wallet short). `flow` names the funnel, `reason` the
 * gate — together they show where people drop off.
 */
export function trackFunnelBlocked(flow: string, reason: string, extra?: Record<string, unknown>) {
  trackEvent("funnel_blocked", { flow, reason, ...extra });
}

/* ------------------------------------------------------------------ */
/* Ecommerce: begin_checkout → Stripe → purchase                       */
/* ------------------------------------------------------------------ */

/** What is being paid for. One item per checkout is all this app sells. */
export type CheckoutItem = {
  /** `entry_individual` | `entry_team` | `acer` — matched by `<CheckoutReturn kind>`. */
  kind: CheckoutKind;
  /** e.g. the event slug, or `acer`. */
  itemId: string;
  itemName: string;
  value: number;
  currency: "PLN" | "USD";
};

export type CheckoutKind = "entry_individual" | "entry_team" | "acer";

const PENDING_KEY = "tm_pending_checkout";

type PendingCheckout = CheckoutItem & { transactionId: string };

function ecommerce(name: string, item: CheckoutItem, transactionId?: string) {
  // GA4's recommended reset, so one ecommerce push never inherits the last one's items.
  pushDataLayer({ event: "ecommerce_clear", ecommerce: null });
  pushDataLayer({
    event: name,
    ecommerce: {
      ...(transactionId ? { transaction_id: transactionId } : {}),
      currency: item.currency,
      value: item.value,
      items: [
        {
          item_id: item.itemId,
          item_name: item.itemName,
          item_category: item.kind,
          price: item.value,
          quantity: 1,
        },
      ],
    },
  });
}

/**
 * Call right before handing off to Stripe Checkout. Pushes `begin_checkout`
 * and remembers the cart for the tab, because the return URL carries no price —
 * `<CheckoutReturn>` reads it back to report the `purchase`.
 */
export function beginCheckout(item: CheckoutItem) {
  ecommerce("begin_checkout", item);
  try {
    const pending: PendingCheckout = { ...item, transactionId: crypto.randomUUID() };
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    // Storage blocked: the purchase just goes unreported.
  }
}

/**
 * Report the remembered checkout of `kind` as a `purchase`, once. Removing it
 * first is what makes a refresh of the success page a no-op.
 */
export function completeCheckout(kind: CheckoutKind) {
  let pending: PendingCheckout | null = null;
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    pending = raw ? (JSON.parse(raw) as PendingCheckout) : null;
    if (pending?.kind !== kind) return;
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    return;
  }
  ecommerce("purchase", pending, pending.transactionId);
}
