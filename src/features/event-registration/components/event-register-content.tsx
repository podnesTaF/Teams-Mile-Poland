import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { GuestRegisterForm } from "@/features/event-registration/components/guest-register-form";
import { RegisterConfirm } from "@/features/event-registration/components/register-confirm";
import { getLatestConsentSnapshot, getRegistration } from "@/features/event-registration/data";
import { makeEventTicketUrl } from "@/features/event-registration/ticket";
import { ProfileForm } from "@/features/profile/components/profile-form";
import { getEntryWithTeam } from "@/features/teams/entries";
import type { ProfileInput } from "@/features/profile/schemas";
import { minorToAcer } from "@/features/wallet/config";
import { getAcerBalance } from "@/features/wallet/data";
import { individualEntryFeeMinor } from "@/features/wallet/entry-fees";
import { Link } from "@/i18n/navigation";
import { getEventBySlug } from "@/lib/events/registry";
// Straight from the store, not the `registry` compat shim: `isPubliclyVisible`
// is new API, and the shim exists only so the pre-DB call sites kept compiling.
import { isPubliclyVisible } from "@/lib/events/store";
import type { EventSummary } from "@/lib/events/types";
import { getUser, canRegister } from "@/lib/auth/user-session";
import { coerceToDate, meetsMinParticipantAge, parseDateOnly } from "@/lib/age";
import { defaultLocale } from "@/lib/i18n/config";
import { isTwoAnswerItem } from "@/lib/legal/consent";
import { getConsentItems, type DocSet } from "@/lib/legal/manifest";
import { acceptsIndividuals, acceptsTeams, entryPricePln } from "@/lib/events/types";
import { hasSettlingIndividualPayment } from "@/features/event-payments/checkout";

/** Serialize a stored DOB (Date via mode:"date", or string) to YYYY-MM-DD. */
function toDateInput(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return value.toISOString().slice(0, 10);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return "";
}

/**
 * The register-for-event card(s): the passwordless guest form (logged out), the
 * inline profile-completion step, already-registered state, or the confirm
 * form. Served by the full `/events/[slug]/register` page.
 */
export async function EventRegisterContent({
  slug,
  locale,
  payment,
}: {
  slug: string;
  locale: string;
  /** `?payment=` on the way back from Stripe Checkout: `success` or `cancelled`. */
  payment?: string;
}) {
  const event = await getEventBySlug(slug);
  if (!acceptsIndividuals(event)) {
    redirect(locale === defaultLocale ? "/" : `/${locale}`);
  }
  // A draft 404s rather than bouncing home, because the lifecycle notice below
  // would otherwise *advertise* a night nobody has announced — "registration
  // opens soon", with its date, for an event that may never run. Same answer as
  // every other public surface (`isPubliclyVisible`), including for a signed-in
  // admin: the draft is visible in `/admin`, nowhere else. `cancelled` is not a
  // draft and keeps its notice.
  if (!isPubliclyVisible(event)) {
    notFound();
  }

  const t = await getTranslations("register");
  // On a mixed night this card is the individual door; the other door — being
  // entered by a team manager — stays one link away so a runner who deep-linked
  // here still gets the choice the event page offers (ADR 0009).
  const teamAlternative = acceptsTeams(event) ? (
    <p className="slots-note register-team-alt" data-team-alternative="1">
      {t("teamAlternative")}{" "}
      <Link href="/teams" className="link">
        {t("teamAlternativeCta")}
      </Link>
    </p>
  ) : null;

  // Priced once for this whole card, through the one helper (ADR 0013) — the
  // guest notice below, the confirm screen's cost row and the action's debit all
  // read the same number, so a night can never be advertised free and charged.
  //
  // A night priced in PLN is paid by card (ADR 0015) and its ACER fee is not
  // taken, so it is not shown either.
  const pricePln = entryPricePln(event, "individual");
  const feeAcer = pricePln > 0 ? 0 : minorToAcer(individualEntryFeeMinor(event));
  /**
   * The price, said before anything is asked for. A guest sees it above the
   * sign-up form — creating an account to discover at the last screen that the
   * night costs money is the failure this line exists to prevent — and it is a
   * price only, with no balance: a visitor with no account has no wallet to
   * report, and the signup grant that pays for their first night lands when the
   * account is created (slice 2).
   */
  const feeNotice =
    pricePln > 0 ? (
      <p className="slots-note register-fee-notice" data-entry-price-notice={pricePln}>
        {t("payment.amount", { price: pricePln })} — {t("payment.guestNote")}
      </p>
    ) : feeAcer > 0 ? (
      <p className="slots-note register-fee-notice" data-entry-fee-notice={feeAcer}>
        {t("fee.amount", { amount: feeAcer })} — {t("fee.note")}
      </p>
    ) : null;

  const user = await getUser();
  if (!user) {
    // Logged-out visitors register right here (passwordless, verification-gated):
    // the guest form creates an unverified account and emails a link. If
    // registration isn't open, show the lifecycle-specific notice instead.
    if (event.status !== "registration_open") {
      return <LifecycleNotice event={event} />;
    }
    return (
      <>
        {teamAlternative}
        {feeNotice}
        <GuestRegisterForm
          eventSlug={slug}
          eventName={event.name}
          eventDate={event.shortDate}
          eventDateIso={event.date}
          eventTime={event.timeRange ? `${event.timeRange.start}–${event.timeRange.end}` : null}
          venue={`${event.venue}, ${event.city}`}
          locale={locale}
        />
      </>
    );
  }

  const existing = await getRegistration(slug, user.id);
  if (existing?.teamEntryId) {
    // Entered by a team manager: the row exists, but it is not theirs to manage
    // here — the ticket, consent and any change go through the team (PRD #64).
    // One person, one entry path per night (ADR 0009), so no second register.
    const found = await getEntryWithTeam(existing.teamEntryId);
    return (
      <section className="iv-card center-narrow" data-registered-via-team="1">
        <span className="iv-eyebrow">{t("alreadyTeamTitle")}</span>
        <p className="iv-sub">{t("alreadyTeamBody", { team: found?.team.name ?? "—" })}</p>
        {found ? (
          <div className="iv-actions">
            <Link href={`/teams/${found.team.slug}`} className="btn btn-red">
              {t("alreadyTeamCta")}
            </Link>
          </div>
        ) : null}
      </section>
    );
  }
  if (existing) {
    return (
      <section className="iv-card center-narrow">
        <span className="iv-eyebrow">{t("alreadyTitle")}</span>
        <p className="iv-sub">{t("alreadyBody")}</p>
        <div className="iv-actions">
          <a href={makeEventTicketUrl(existing.id, { locale })} className="btn btn-red">
            {t("viewTicket")}
          </a>
        </div>
      </section>
    );
  }

  // Back from Stripe with the fee paid, and the webhook has not written the
  // registration yet — usually a second or two. Before the lifecycle notice:
  // a runner who paid as entries closed has still paid.
  if (
    pricePln > 0 &&
    payment !== "cancelled" &&
    (payment === "success" || (await hasSettlingIndividualPayment(slug, user.id)))
  ) {
    return (
      <section className="iv-card center-narrow" data-payment-settling="1">
        <span className="iv-eyebrow">{t("payment.settlingTitle")}</span>
        <p className="iv-sub">{t("payment.settlingBody")}</p>
        <div className="iv-actions">
          <Link href={`/events/${slug}/register`} className="btn btn-red">
            {t("payment.refresh")}
          </Link>
        </div>
      </section>
    );
  }

  if (event.status !== "registration_open") {
    return <LifecycleNotice event={event} />;
  }
  if (!user.emailVerified) {
    return (
      <Notice
        title={t("verifyTitle")}
        body={t("verifyBody")}
        linkHref="/auth/verify-email"
        linkText={t("verifyCta")}
      />
    );
  }
  if (!canRegister(user)) {
    // Complete the profile inline (no bounce to /profile). Saving returns
    // straight to this page, which then shows the confirm step.
    const pu = user as typeof user & {
      firstName?: string | null;
      lastName?: string | null;
      dateOfBirth?: unknown;
      sex?: "M" | "F" | null;
      club?: string | null;
      phone?: string | null;
    };
    const initial: ProfileInput = {
      firstName: pu.firstName ?? "",
      lastName: pu.lastName ?? "",
      dateOfBirth: toDateInput(pu.dateOfBirth),
      sex: (pu.sex ?? "") as ProfileInput["sex"],
      club: pu.club ?? "",
      phone: pu.phone ?? "",
    };
    return (
      <div className="center-narrow" style={{ maxWidth: 620 }}>
        <div className="page-head" style={{ marginBottom: 16 }}>
          <span className="iv-eyebrow">{t("confirm.eyebrow")}</span>
          <h1 className="iv-title">{t("profileTitle")}</h1>
        </div>
        <div className="banner banner--info" style={{ marginBottom: 16 }}>
          <div className="banner__body">
            <div className="banner__txt">{t("profileBody")}</div>
          </div>
        </div>
        <ProfileForm
          initial={initial}
          redirectTo={`/events/${slug}/register`}
          maxDobAsOf={event.date}
        />
      </div>
    );
  }

  const dob = coerceToDate((user as { dateOfBirth?: unknown }).dateOfBirth);
  if (!dob || !meetsMinParticipantAge(dob, parseDateOnly(event.date))) {
    return (
      <Notice
        title={t("ageTitle")}
        body={t("ageBody")}
        linkHref="/profile"
        linkText={t("profileCta")}
      />
    );
  }

  const u = user as typeof user & { firstName?: string | null; lastName?: string | null };
  const runnerName =
    [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || user.name || user.email;

  // The individual corpus, and the items it asks for — resolved server-side so
  // the client never chooses which documents apply to it (ADR 0006). The set
  // follows the entry path, not the event: a `mixed` night's team members sign
  // the team set on their confirmation screen instead (ADR 0009).
  const docSet: DocSet = "individual";
  const consentItems = getConsentItems(docSet).map((item) => ({
    id: item.id,
    docSlug: item.docSlug,
    twoAnswer: isTwoAnswerItem(item),
  }));
  // Emergency contact (and address) carried over from the runner's most recent
  // registration, so a second race night is not a retype (user story 10). Never
  // read from `users` — it is not a profile field, deliberately.
  const snapshot = await getLatestConsentSnapshot(user.id);
  // Read only when there is something to spend it on: a free night asks nobody's
  // wallet, and a `SUM` over the ledger is not worth issuing to render a number
  // the screen will not show.
  const balanceAcer = feeAcer > 0 ? minorToAcer(await getAcerBalance(user.id)) : 0;

  return (
    <>
      {teamAlternative}
      <RegisterConfirm
        eventSlug={slug}
        eventName={event.name}
        eventDate={event.shortDate}
        eventTime={event.timeRange ? `${event.timeRange.start}–${event.timeRange.end}` : null}
        venue={`${event.venue}, ${event.city}`}
        runnerName={runnerName}
        runnerEmail={user.email}
        docSet={docSet}
        docLocale={locale as "pl" | "en" | "ua"}
        consentItems={consentItems}
        prefillEmergencyContact={snapshot?.emergencyContact ?? ""}
        prefillAddress={snapshot?.address ?? ""}
        feeAcer={feeAcer}
        balanceAcer={balanceAcer}
        pricePln={pricePln}
        paymentCancelled={payment === "cancelled"}
      />
    </>
  );
}

/**
 * Distinct notice per non-open lifecycle state (both guest and signed-in
 * entries): `upcoming` = opens-soon + date, `registration_closed` = closed,
 * `completed` = finished + link to results, `cancelled` = called off + a link
 * back to the nights still on. `full` is n/a (free/uncapped), and `draft` never
 * arrives here — an unannounced night 404s above.
 */
async function LifecycleNotice({ event }: { event: EventSummary }) {
  const t = await getTranslations("register");
  if (event.status === "cancelled") {
    // Borrows the event page's cancelled copy (`events.detail.states.cancelled`,
    // trilingual already) rather than a near-duplicate under `register.*`: this
    // is the same sentence the detail page's banner says, and it must not be
    // possible for the two to disagree about whether the night is off.
    const te = await getTranslations("events");
    return (
      <Notice
        title={te("detail.states.cancelled.bannerTitle")}
        body={te("detail.states.cancelled.bannerTxt")}
        linkHref="/#events"
        linkText={te("detail.states.cancelled.cta")}
      />
    );
  }
  if (event.status === "upcoming") {
    return (
      <Notice
        title={t("lifecycle.upcomingTitle")}
        body={t("lifecycle.upcomingBody", { date: event.shortDate })}
      />
    );
  }
  if (event.status === "completed") {
    return (
      <Notice
        title={t("lifecycle.completedTitle")}
        body={t("lifecycle.completedBody")}
        linkHref="/#results"
        linkText={t("lifecycle.completedCta")}
      />
    );
  }
  // registration_closed (and any other non-open fallback).
  return <Notice title={t("lifecycle.closedTitle")} body={t("lifecycle.closedBody")} />;
}

function Notice({
  title,
  body,
  linkHref,
  linkText,
}: {
  title: string;
  body: string;
  linkHref?: string;
  linkText?: string;
}) {
  return (
    <section className="iv-card center-narrow">
      <span className="iv-eyebrow">{title}</span>
      <p className="iv-sub">{body}</p>
      {linkHref && linkText ? (
        <div className="iv-actions">
          <Link href={linkHref} className="btn btn-red">
            {linkText}
          </Link>
        </div>
      ) : null}
    </section>
  );
}
