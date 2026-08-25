import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "@/app/series-flows.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { ChangePasswordForm } from "@/features/auth/components/change-password-form";
import { LogOutButton } from "@/features/auth/components/log-out-button";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

import {
  getUserRegistrations,
  publishedHeatsByRegistration,
} from "@/features/event-registration/data";
import {
  ConfirmAttendanceForm,
  confirmNotice,
} from "@/features/event-registration/components/confirm-attendance-form";
import {
  awaitingConfirmation,
  isConfirmationOpen,
  slugsWithPublishedHeats,
} from "@/features/event-registration/confirmation";
import { makeEventTicketUrl } from "@/features/event-registration/ticket";
import { SeriesList, type RaceRow } from "@/features/event-registration/components/series-list";
import { ProfileForm } from "@/features/profile/components/profile-form";
import { getAttendedLegacySlugs } from "@/features/profile/data";
import {
  getOrCreateReferralCode,
  getReferralStats,
  makeReferralUrl,
} from "@/features/referral/data";
import { InviteLink } from "@/features/team/components/invite-link";
import type { ProfileInput } from "@/features/profile/schemas";
import { formatHeatTime } from "@/lib/events/heat-time";
import { isRaceRun } from "@/lib/events/participation";
import { getEventBySlug, getSeriesEvents } from "@/lib/events/registry";
import { formatTime } from "@/lib/events/time";
import type { EventSummary } from "@/lib/events/types";
import { getDirectResultRefs, getMergedResults } from "@/lib/events/results-data";
import { findUserResults } from "@/lib/events/user-results";
import { defaultLocale } from "@/lib/i18n/config";
import { getUser, isAdmin, isProfileComplete } from "@/lib/auth/user-session";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ redirectTo?: string; c?: string }>;
};

/** Serialize a stored DOB (Date via mode:"date", or string) to YYYY-MM-DD. */
function toDateInput(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  return "";
}

function AccordionChevron() {
  return (
    <span className="pf-acc__chev" aria-hidden>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export default async function ProfilePage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { redirectTo, c } = await searchParams;
  setRequestLocale(locale);

  const user = await getUser();
  if (!user) {
    const dest = `/auth/sign-in?redirectTo=${encodeURIComponent(redirectTo || "/profile")}`;
    redirect(locale === defaultLocale ? dest : `/${locale}${dest}`);
  }

  const u = user as typeof user & {
    firstName?: string | null;
    lastName?: string | null;
    dateOfBirth?: unknown;
    sex?: "M" | "F" | null;
    club?: string | null;
    phone?: string | null;
  };

  const initial: ProfileInput = {
    firstName: u.firstName ?? "",
    lastName: u.lastName ?? "",
    dateOfBirth: toDateInput(u.dateOfBirth),
    sex: (u.sex ?? "") as ProfileInput["sex"],
    club: u.club ?? "",
    phone: u.phone ?? "",
  };

  const t = await getTranslations("profile");
  const registrations = await getUserRegistrations(user.id);
  const incomplete = !isProfileComplete(user);
  // The finish-profile round-trip (registration sends people here to fill the
  // form) and an incomplete profile both make settings the main event: the
  // section moves to the top and the details accordion starts open.
  const settingsFirst = incomplete || Boolean(redirectTo);

  // Confirmation closes once the heat card is published — one query for the
  // whole list rather than one per registration.
  const publishedSlugs = await slugsWithPublishedHeats(registrations.map((r) => r.eventSlug));
  // Read-only heat display (PRD #26, slice #30) — published heats only, so the
  // card never shows a lane the runner has not been emailed about.
  const heats = await publishedHeatsByRegistration(registrations.map((r) => r.id));
  const now = new Date();
  const notice = confirmNotice(c);

  // Results are DB-first (timing imports) with config sheets as fallback.
  // Imported rows may carry a registration link resolved from the (heat, bib)
  // lease — those outrank name matching; everything else is recovered by
  // name-matching within the events the user participated in: live
  // registrations plus imported legacy attendance.
  const legacySlugs = await getAttendedLegacySlugs(user.id);
  const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ") || user.name;
  const participations = [
    ...registrations.map((r) => ({ eventSlug: r.eventSlug, bib: r.bib })),
    ...legacySlugs.map((eventSlug) => ({ eventSlug })),
  ];
  const [resultsBySlug, directRefs] = await Promise.all([
    getMergedResults(participations.map((p) => p.eventSlug)),
    getDirectResultRefs(registrations.map((r) => r.id)),
  ]);
  // The events behind those slugs, resolved once here: the matcher takes them
  // as a map now, and the registration cards below need the same lookup from
  // inside a render callback, which cannot await.
  const eventsBySlug = new Map<string, EventSummary>();
  for (const slug of new Set(participations.map((p) => p.eventSlug))) {
    const event = await getEventBySlug(slug);
    if (event) eventsBySlug.set(slug, event);
  }
  const myResults = findUserResults(
    fullName,
    participations,
    resultsBySlug,
    directRefs,
    eventsBySlug,
  );
  const bestTimeCs =
    myResults.length > 0 ? Math.min(...myResults.map((r) => r.entry.timeCs)) : null;

  // Referral link + funnel counts (sign-ups → race registrations → checked in).
  // The code is issued lazily on first profile view.
  const [referralCode, referralStats] = await Promise.all([
    getOrCreateReferralCode(user.id),
    getReferralStats(user.id),
  ]);
  const referralUrl = makeReferralUrl(referralCode, locale);

  // Race nights the user could still join — any registration row (even a
  // cancelled one) excludes the event, since registerForEvent rejects those
  // as duplicates and a dead-end Register CTA is worse than no row.
  const registeredSlugs = new Set(registrations.map((r) => r.eventSlug));
  const otherEvents: RaceRow[] = (await getSeriesEvents())
    .filter((event) => !registeredSlugs.has(event.slug))
    .map((event) => {
      const [y, m, d] = event.date.split("-");
      return {
        slug: event.slug,
        d,
        m: MONTHS[Number(m) - 1] ?? m,
        y,
        title: event.name,
        status: event.status,
        time: event.timeRange ? event.timeRange.start : null,
        venue: event.venue,
      };
    });

  // The canonical "races run" (`src/lib/events/participation.ts`): races the
  // runner was actually at the start line for, not races they signed up to. The
  // rows are already loaded, so this counts in memory instead of re-querying;
  // `legacySlugs` is the attended-only legacy read, one slug per legacy race.
  const raceCount = registrations.filter((r) => isRaceRun(r.status)).length + legacySlugs.length;
  const initials =
    (
      [u.firstName?.[0], u.lastName?.[0]].filter(Boolean).join("") ||
      (fullName || user.email)[0] ||
      "?"
    ).toUpperCase();

  const settingsSection = (
    <section className="regs-section pf-section" id="settings">
      <div className="section-label">
        <span className="iv-eyebrow">{t("settings.title")}</span>
      </div>
      <h2 className="iv-title pf-h2">{t("settings.heading")}</h2>

      <div className="pf-acc-list">
        <details className="pf-acc" open={settingsFirst}>
          <summary className="pf-acc__head">
            <span className="pf-acc__tw">
              <span className="pf-acc__t">{t("settings.profileSummary")}</span>
              <span className="pf-acc__hint">{t("settings.profileHint")}</span>
            </span>
            <AccordionChevron />
          </summary>
          <ProfileForm initial={initial} redirectTo={redirectTo} />
        </details>

        <details className="pf-acc">
          <summary className="pf-acc__head">
            <span className="pf-acc__tw">
              <span className="pf-acc__t">{t("settings.passwordSummary")}</span>
              <span className="pf-acc__hint">{t("settings.passwordHint")}</span>
            </span>
            <AccordionChevron />
          </summary>
          <ChangePasswordForm />
        </details>
      </div>
    </section>
  );

  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap">
          <header className="pf-hero">
            <div className="avatar pf-hero__avatar" aria-hidden>
              {initials}
            </div>
            <div className="pf-hero__id">
              <span className="iv-eyebrow">{t("eyebrow")}</span>
              <h1 className="pf-hero__name">{fullName || t("title")}</h1>
              <span className="profile-email">{user.email}</span>
            </div>
            <LogOutButton className="btn btn-stroke-dark btn-sm pf-hero__out" />
          </header>

          <div className="pf-stats">
            <div className="pf-stat">
              <span className="pf-stat__v">{raceCount}</span>
              <span className="pf-stat__k">{t("stats.races")}</span>
            </div>
            <div className="pf-stat">
              <span className="pf-stat__v">{bestTimeCs !== null ? formatTime(bestTimeCs) : "—"}</span>
              <span className="pf-stat__k">{t("stats.best")}</span>
            </div>
            <div className="pf-stat">
              <span className="pf-stat__v">{referralStats.signups}</span>
              <span className="pf-stat__k">{t("stats.invited")}</span>
            </div>
          </div>

          <nav className="pf-nav" aria-label={t("nav.label")}>
            <a className="pf-nav__link" href="#registrations">
              {t("nav.races")}
            </a>
            {myResults.length > 0 ? (
              <a className="pf-nav__link" href="#results">
                {t("nav.results")}
              </a>
            ) : null}
            <a className="pf-nav__link" href="#referrals">
              {t("nav.invite")}
            </a>
            <a className="pf-nav__link" href="#settings">
              {t("nav.settings")}
            </a>
            {/* The one pill that leaves the page — the wallet is its own screen
              * (per-user money, never pre-rendered), and this strip is where a
              * runner looks for the rest of their cabinet. Admin-only while the
              * wallet is in testing; the /wallet route is gated to match. */}
            {isAdmin(user) ? (
              <Link className="pf-nav__link pf-nav__link--go" href="/wallet">
                {t("nav.wallet")} →
              </Link>
            ) : null}
          </nav>

          {incomplete ? (
            <div className="banner banner--info" style={{ marginTop: 20 }}>
              <span className="banner__ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8h.01M11 12h1v4h1" strokeLinecap="round" />
                </svg>
              </span>
              <div className="banner__body">
                <div className="banner__txt">{t("completePrompt")}</div>
              </div>
            </div>
          ) : null}

          {settingsFirst ? settingsSection : null}

          <section className="regs-section pf-section" id="registrations">
            <div className="section-label">
              <span className="iv-eyebrow">{t("registrations.title")}</span>
            </div>
            <h2 className="iv-title pf-h2">{t("registrations.heading")}</h2>

            {notice ? (
              <div
                className={`banner ${notice.ok ? "banner--ok" : "banner--warn"}`}
                style={{ marginTop: 16 }}
                role="status"
              >
                <div className="banner__body">
                  <div className="banner__txt">{t(`registrations.confirm.${notice.key}`)}</div>
                </div>
              </div>
            ) : null}

            {registrations.length === 0 ? (
              <div className="regs-empty">{t("registrations.empty")}</div>
            ) : (
              <div className="reg-list">
                {registrations.map((reg) => {
                  const event = eventsBySlug.get(reg.eventSlug);
                  const active =
                    reg.status === "registered" ||
                    reg.status === "confirmed" ||
                    reg.status === "checked_in";
                  const [y, m, d] = (event?.date ?? "").split("-");
                  const day = d ? String(parseInt(d, 10)) : reg.eventSlug;
                  const month = m ? MONTHS[parseInt(m, 10) - 1] ?? "" : "";
                  const canConfirm =
                    awaitingConfirmation(reg) &&
                    isConfirmationOpen({
                      event,
                      now,
                      heatsPublished: publishedSlugs.has(reg.eventSlug),
                    });
                  // A heat is only meaningful in the run-up to the race; once the
                  // event is completed the result, not the lane, is the story.
                  const heat = event?.status === "completed" ? undefined : heats.get(reg.id);
                  return (
                    <div key={reg.id} className="reg-card" data-state={active ? "registered" : "completed"}>
                      <div className="race-date">
                        <span className="race-date__d">{day}</span>
                        {month ? <span className="race-date__m">{month}</span> : null}
                        {y ? <span className="race-date__y">{y}</span> : null}
                      </div>
                      <div className="reg-card__body">
                        <span className="reg-card__title">{event?.name ?? reg.eventSlug}</span>
                        <div className="reg-card__meta">
                          <span>
                            {reg.bib
                              ? `${t("registrations.bib")} #${reg.bib}`
                              : t("registrations.bibPending")}
                          </span>
                          {heat ? (
                            <span>
                              {t("registrations.heat")}{" "}
                              {t("registrations.heatValue", {
                                number: heat.number,
                                time: formatHeatTime(heat.scheduledAt),
                              })}
                            </span>
                          ) : null}
                        </div>
                        {canConfirm ? (
                          <div className="reg-card__ask">{t("registrations.confirm.ask")}</div>
                        ) : null}
                      </div>
                      <div className="reg-card__actions">
                        <span className={`status ${active ? "status--registered" : "status--completed"}`}>
                          <span className="status__dot" />
                          {t(`registrations.status.${reg.status}`)}
                        </span>
                        {canConfirm ? (
                          <ConfirmAttendanceForm
                            registrationId={reg.id}
                            locale={locale}
                            surface="profile"
                          />
                        ) : null}
                        {active ? (
                          <a
                            className={`btn btn-sm ${canConfirm ? "btn-stroke-dark" : "btn-red"}`}
                            href={makeEventTicketUrl(reg.id, { locale })}
                          >
                            {t("registrations.ticket")}
                          </a>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {otherEvents.length > 0 ? (
              <div className="regs-more">
                <h3 className="iv-title" style={{ fontSize: "clamp(1.15rem, 2.2vw, 1.4rem)", marginTop: 32 }}>
                  {t("registrations.moreHeading")}
                </h3>
                <SeriesList rows={otherEvents} />
              </div>
            ) : null}
          </section>

          {myResults.length > 0 ? (
            <section className="regs-section pf-section" id="results">
              <div className="section-label">
                <span className="iv-eyebrow">{t("results.title")}</span>
              </div>
              <h2 className="iv-title pf-h2">{t("results.heading")}</h2>

              <div className="reg-list">
                {myResults.map((res) => {
                  const [y, m, d] = res.event.date.split("-");
                  return (
                    <div
                      key={`${res.event.slug}:${res.heatNumber}:${res.entry.bib}`}
                      className="reg-card res-card"
                    >
                      <div className="race-date">
                        <span className="race-date__d">{String(parseInt(d, 10))}</span>
                        <span className="race-date__m">{MONTHS[parseInt(m, 10) - 1] ?? ""}</span>
                        <span className="race-date__y">{y}</span>
                      </div>
                      <div className="reg-card__body">
                        <span className="reg-card__title">{res.event.name}</span>
                        <div className="reg-card__meta">
                          <span>
                            {t("results.place")}{" "}
                            <b>{t("results.placeValue", { rank: res.rank, total: res.total })}</b>
                          </span>
                          <span>{t("results.heat", { number: res.heatNumber })}</span>
                          <span>{t(`results.category.${res.entry.gender}`)}</span>
                        </div>
                      </div>
                      <div className="res-card__perf">
                        {myResults.length > 1 && res.entry.timeCs === bestTimeCs ? (
                          <span className="res-card__best">{t("results.best")}</span>
                        ) : null}
                        <span className="res-card__time">{formatTime(res.entry.timeCs)}</span>
                        <span className="res-card__lvl">{t("results.level", { n: res.level })}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="regs-section pf-section" id="referrals">
            <div className="section-label">
              <span className="iv-eyebrow">{t("referrals.title")}</span>
            </div>
            <h2 className="iv-title pf-h2">{t("referrals.heading")}</h2>

            <section className="iv-share" style={{ marginTop: 16 }}>
              <p className="iv-share__hint">{t("referrals.hint")}</p>
              <InviteLink
                url={referralUrl}
                copyLabel={t("referrals.copy")}
                copiedLabel={t("referrals.copied")}
              />
            </section>

            <div className="pf-ref-stats">
              <div className="iv-info">
                <div className="iv-info__label">{t("referrals.signups")}</div>
                <div className="iv-info__value">{referralStats.signups}</div>
              </div>
              <div className="iv-info">
                <div className="iv-info__label">{t("referrals.raceRegistrations")}</div>
                <div className="iv-info__value">{referralStats.raceRegistrations}</div>
              </div>
              <div className="iv-info">
                <div className="iv-info__label">{t("referrals.participations")}</div>
                <div className="iv-info__value">{referralStats.participations}</div>
              </div>
            </div>
          </section>

          {settingsFirst ? null : settingsSection}
        </div>
      </main>
    </div>
  );
}
