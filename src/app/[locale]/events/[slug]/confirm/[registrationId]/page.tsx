import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "@/app/series-flows.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { getLatestConsentSnapshot } from "@/features/event-registration/data";
import { makeEventTicketUrl } from "@/features/event-registration/ticket";
import { loadConfirmScreen } from "@/features/teams/confirm-service";
import {
  StateCard,
  TeamConfirmForm,
} from "@/features/teams/components/team-confirm-form";
import { verifyEventTicket } from "@/features/ticket/sign";
import { coerceToDate, formatDateOnly, meetsMinParticipantAge, parseDateOnly } from "@/lib/age";
import { getUser } from "@/lib/auth/user-session";
import { formatEventLongDate } from "@/lib/events/time";
import { locales, localePath } from "@/lib/i18n/config";
import { isTwoAnswerItem } from "@/lib/legal/consent";
import { getConsentItems } from "@/lib/legal/manifest";

/**
 * The member confirmation screen (PRD #64, Routes →
 * `/[locale]/events/[slug]/confirm/[registrationId]?s=<sig>`; issue #68).
 *
 * The one thing a regular member does: open one link, read, tick, press one
 * button. Everything else about their entry is their manager's (#67).
 *
 * **Two ways in, one page** (user stories 20–21). The emailed link carries
 * `?s=<sig>` — the ordinary event-ticket HMAC that `confirmLinkUrl` signs — so a
 * member on a phone confirms without ever meeting a password, exactly as the
 * ticket page already works. The profile card's "Confirm" button links here
 * *without* a signature and relies on the session instead. Either is sufficient;
 * neither is required.
 *
 * **Anyone else gets the gated card**, not a 404 and not a refusal that names
 * the runner. The card carries no personal data at all — no name, no team, no
 * event — because it is what a stranger sees, and it is also what a member sees
 * when their link has been mangled in a mail client. It offers sign-in as the
 * way through, which is the only honest advice: a lost signature cannot be
 * recovered, but a session works just as well.
 *
 * Dynamic, with no `generateStaticParams`: `searchParams` alone opts this route
 * into request-time rendering (Next 16 `page.js` reference), and what it shows
 * depends entirely on who is asking and on a flag that changes the moment the
 * member presses the button.
 *
 * Terminal states are rendered *server-side* wherever the page can already see
 * them on load — already confirmed (with the ticket link), underage on the event
 * date, and the cancelled night's banner — using the same {@link StateCard} the
 * island renders for the same conclusions reached at submit time. One card, one
 * set of markers, whichever side got there first.
 */

type PageProps = {
  params: Promise<{ locale: string; slug: string; registrationId: string }>;
  searchParams: Promise<{ s?: string }>;
};

export default async function TeamConfirmPage({ params, searchParams }: PageProps) {
  const { locale, slug, registrationId } = await params;
  const { s } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations("register.teamConfirm");

  // Pure, no database: a mangled or replayed signature is decided before
  // anything is read, so the gated card below costs one HMAC and nothing else.
  const bySignature = Boolean(s) && verifyEventTicket(registrationId, s!);
  const session = await getUser();

  /**
   * The gated card. Deliberately identical for every way in which a visitor may
   * not act here — no signature and no session, a bad signature, a signed-in
   * stranger, a registration that does not exist — so the URL is not an oracle
   * for whose registration id is whose.
   */
  const gated = (
    <Shell>
      <StateCard
        state="gated"
        title={t("gate.title")}
        body={t("gate.body")}
        ctaHref={localePath(
          locale,
          `/auth/sign-in?redirectTo=${encodeURIComponent(
            `/events/${slug}/confirm/${registrationId}`,
          )}`,
        )}
        ctaLabel={t("gate.cta")}
      />
    </Shell>
  );

  if (!bySignature && !session) return gated;

  const screen = await loadConfirmScreen(registrationId);
  if (!screen) {
    // A *valid* signature naming nothing is a withdrawn entry or a removed
    // member: the honest answer is the same 404 every other surface gives a
    // slug that no longer exists. Without one, the gated card — see above.
    if (bySignature) notFound();
    return gated;
  }
  const { registration, user, event, team } = screen;

  if (!bySignature && session?.id !== registration.userId) return gated;

  // The event segment must be the registration's own night. Not a security
  // boundary — the caller is already authorized — but a wrong slug would print
  // one event's name over another's documents.
  if (event.slug !== slug) notFound();

  const eventDate = formatEventLongDate(locale, event.date);
  const venue = event.venue ? `${event.venue}, ${event.city}` : "";

  // Already confirmed → the ticket, which is the only thing left to want
  // (user story 22, and the issue's sixth criterion). The profile card has
  // flipped to its normal ticket state by now for the same reason: `confirmed`
  // is `consent_pending = false` and nothing else.
  if (!registration.consentPending) {
    return (
      <Shell registrationId={registrationId} team={team.slug}>
        <Head eyebrow={t("eyebrow")} title={event.name} meta={eventDate} team={team.slug} />
        <StateCard
          state="already_confirmed"
          title={t("already.title")}
          body={t("already.body")}
          ctaHref={makeEventTicketUrl(registrationId, { locale })}
          ctaLabel={t("already.cta")}
        />
      </Shell>
    );
  }

  // Cancelled → the banner, and no form. The night is off; a Statement accepted
  // for it would be evidence of nothing (PRD #64 Cross-Cutting Decision 3).
  if (event.status === "cancelled") {
    return (
      <Shell registrationId={registrationId} team={team.slug}>
        <Head eyebrow={t("eyebrow")} title={event.name} meta={eventDate} team={team.slug} />
        <StateCard state="cancelled" title={t("cancelled.title")} body={t("cancelled.body")} />
      </Shell>
    );
  }

  // 18 **on the event date** (brief Decision 7). The declaration says "on the
  // day of the event I am 18 years of age or older", so refusing here is
  // refusing to let someone sign something false — the issue's `age` refusal,
  // rendered as its own state rather than a dead form (user story 23).
  const dob = coerceToDate(user.dateOfBirth);
  if (!dob || !meetsMinParticipantAge(dob, parseDateOnly(event.date))) {
    return (
      <Shell registrationId={registrationId} team={team.slug}>
        <Head eyebrow={t("eyebrow")} title={event.name} meta={eventDate} team={team.slug} />
        <StateCard state="age" title={t("age.title")} body={t("age.body")} />
      </Shell>
    );
  }

  // The team corpus and its six items, resolved server-side so the client never
  // chooses which documents apply to it (ADR 0006). Labels come from
  // `legal.teamItems.<id>` — the team documents' own wording against the same
  // six frozen ids as the individual set — and are passed in resolved, because
  // a client island must not have to know which catalog an item id lives in.
  const tItems = await getTranslations("legal.teamItems");
  const consentItems = getConsentItems("team").map((item) => ({
    id: item.id,
    docSlug: item.docSlug,
    twoAnswer: isTwoAnswerItem(item),
    label: tItems(item.id),
  }));

  // Emergency contact (and address) carried over from the member's most recent
  // snapshot, so a second race night is not a retype (user story 18). Never
  // read from `users` — neither is a profile field, deliberately.
  const snapshot = await getLatestConsentSnapshot(user.id);

  const memberName =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.name || user.email;
  const docLocale = ((locales as readonly string[]).includes(locale) ? locale : "pl") as
    | "pl"
    | "en"
    | "ua";

  return (
    <Shell registrationId={registrationId} team={team.slug}>
      <Head eyebrow={t("eyebrow")} title={t("title")} meta={t("subtitle")} team={team.slug} />
      <TeamConfirmForm
        registrationId={registrationId}
        eventSlug={slug}
        // Passed back to the action verbatim: a member who arrived by the
        // emailed link has no session, and the submit needs the same proof the
        // page load used.
        sig={bySignature ? (s ?? null) : null}
        docLocale={docLocale}
        consentItems={consentItems}
        facts={{
          eventName: event.name,
          eventDate,
          venue,
          teamName: team.name,
          memberName,
          memberEmail: user.email,
          memberBirthDate: formatDateOnly(dob),
          memberPhone: user.phone ?? "",
        }}
        prefillEmergencyContact={snapshot?.emergencyContact ?? ""}
        prefillAddress={snapshot?.address ?? ""}
      />
    </Shell>
  );
}

/** The page frame, shared by the form and every terminal state. */
function Shell({
  children,
  registrationId,
  team,
}: {
  children: React.ReactNode;
  registrationId?: string;
  team?: string;
}) {
  return (
    <div
      className="ace-landing iv"
      data-team-confirm-page={registrationId ?? "1"}
      data-team-confirm-team={team}
    >
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap">{children}</div>
      </main>
    </div>
  );
}

function Head({
  eyebrow,
  title,
  meta,
  team,
}: {
  eyebrow: string;
  title: string;
  meta: string;
  team: string;
}) {
  return (
    <div className="page-head" style={{ marginBottom: 22 }} data-team-confirm-head={team}>
      <span className="iv-eyebrow">{eyebrow}</span>
      <h1 className="iv-title">{title}</h1>
      <p className="iv-sub">{meta}</p>
    </div>
  );
}
