import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "@/app/series-flows.css";
import "@/app/gallery.css";
import "./heats/heats.css";
import "./entry-explainer.css";
import "./event-detail.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { EntryRulesLink } from "@/features/event-registration/components/entry-rules-link";
import { EntryPriceForViewer } from "@/features/event-registration/components/entry-price-for-viewer";
import { EventRegisterCta } from "@/features/event-registration/components/event-register-cta";
import { ResultsTables } from "@/features/event-results/results-tables";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getEventDocuments, resolveDocumentFile } from "@/lib/events/documents";
import { getEventMediaConfig } from "@/lib/events/media-config";
import { individualEntryFeeMinor } from "@/features/wallet/entry-fees";
import { minorToAcer } from "@/features/wallet/config";
import { getEventBySlug, getFirstHeatTime } from "@/lib/events/registry";
import { getPublicResults } from "@/lib/events/results-data";
// Straight from the store, not the `registry` compat shim: `isPubliclyVisible`
// is new API, and the shim exists only so the pre-DB call sites kept compiling.
import { getAllEvents, isPubliclyVisible } from "@/lib/events/store";
import { formatEventLongDate } from "@/lib/events/time";
import {
  acceptsIndividuals,
  acceptsTeams,
  entryPricePln,
  isSeriesEvent,
  type EventStatus,
  RACE_RESULT_GROUP_URL,
} from "@/lib/events/types";
import { defaultLocale } from "@/lib/i18n/config";
import { venueMapsUrl } from "@/lib/marketing/event";

import { EventMediaTeaser } from "./event-media-teaser";
import { StickyEntryBar } from "./sticky-entry-bar";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Lifecycle status → mockup detail display state (server-side; no live "full"). */
type DetailState = "open" | "soon" | "closed" | "completed" | "cancelled";
function detailState(status: EventStatus): DetailState {
  switch (status) {
    case "registration_open":
      return "open";
    case "upcoming":
      return "soon";
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
    // `draft` has no public display state, because it never gets one: an
    // unannounced night 404s on every public surface before this page renders,
    // and it is left out of `generateStaticParams` besides. This arm exists
    // only to keep the function total, and it answers with the most inert
    // state there is — `soon` renders a disabled button and no start list, no
    // results and no gallery — so that even a hole in the visibility guard
    // would advertise nothing about an unannounced night.
    case "draft":
      return "soon";
    case "registration_closed":
      return "closed";
  }
}
const STATUS_KEY: Record<DetailState, string> = {
  open: "registration_open",
  soon: "upcoming",
  closed: "registration_closed",
  completed: "completed",
  cancelled: "cancelled",
};
const BANNER_TONE: Record<DetailState, string> = {
  open: "info",
  soon: "warn",
  closed: "info",
  completed: "ok",
  // `red` is the stylesheet's error tone (`series-flows.css` defines
  // `banner--warn|red|info|ok`, and nothing else).
  cancelled: "red",
};

/**
 * Safety-net ISR: a write that bypasses the app (a manual DB correction, a
 * seed) reaches no `revalidatePath` and would leave this page stale until a
 * deploy. Five minutes bounds that; admin actions still invalidate instantly.
 * Must stay a literal — the value is statically analyzed.
 */
export const revalidate = 300;

export async function generateStaticParams() {
  // Every event on the current stack, including completed ones — a race night
  // that flips to `completed` must keep its detail page (gallery teaser,
  // gallery back-link, and the media-live mailing CTA all point at it).
  // `getSeriesEvents` drops completed events and drives landing cards, so it
  // can't back the params.
  //
  // `isSeriesEvent` rather than an `individual` filter (PRD #64): a `team`
  // event now has a public page too — the entered-teams count and the
  // entry-by-team notice — and it has to be prerendered like the rest. The
  // predicate still excludes the one frozen legacy TEAMS MILE night, whose
  // public surface is the untouched `/team` stack (ADR 0008).
  //
  // Filtered by `isPubliclyVisible`, which drops drafts and keeps cancelled
  // nights: a cancelled night's page still renders (with its banner), an
  // unannounced one has no page at all. Prerendering a draft would publish the
  // slug — and the name, date and venue on it — the moment it was created.
  // `dynamicParams` stays at its default `true`, so a draft that is later
  // announced renders on first request without a deploy.
  return (await getAllEvents())
    .filter((event) => isSeriesEvent(event) && isPubliclyVisible(event))
    .map((event) => ({ slug: event.slug }));
}

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export default async function EventDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const event = await getEventBySlug(slug);
  // A draft is indistinguishable from a slug that does not exist: not published,
  // so not found — for an admin reading this page too, since the admin's view of
  // a draft lives in `/admin`. `dynamicParams` means an un-prerendered slug still
  // reaches this handler, so the gate has to be here and not only in the params.
  //
  // `isSeriesEvent` admits `team` events (PRD #64) and still 404s the frozen
  // legacy night, whose public page is the `/team` stack.
  if (!event || !isSeriesEvent(event) || !isPubliclyVisible(event)) {
    notFound();
  }

  const t = await getTranslations("events");
  const state = detailState(event.status);
  /**
   * Every night has one door: the register flow (ADR 0016). On a night with a
   * team path a runner's race follows their roster — a member of a placement
   * team runs the team race free, everyone else the individual mile — so the
   * visitor chooses nothing here; a short explainer under the CTA says how it
   * works. A pure team night keeps its notice and the two team documents.
   * The facts, the banner, the documents, the results and the gallery read the
   * same on every kind of night.
   */
  const teamPath = acceptsTeams(event);
  const individualPath = acceptsIndividuals(event);
  const isTeamEvent = teamPath && !individualPath;
  /**
   * What the individual mile costs, in whole ACER (ADR 0013) — read through the
   * fee helper, never off the column, so this page, the register flow and the
   * transaction that takes the money agree by construction.
   *
   * Gated on the individual path, not merely on being non-zero: a team-only
   * night carrying a stray individual fee must not advertise a door that does
   * not exist here. `0` means free, which is every night until an admin prices
   * one, and the entry row keeps reading "Free" exactly as it did before fees
   * existed.
   *
   * There is no team price on this page (ADR 0016): the team race is free for
   * a placement team's members, and `team_price_pln` is read by nothing public.
   */
  //
  // A night priced in PLN is paid by card (ADR 0015) and its ACER fee is not
  // taken, so the PLN price replaces it here too.
  const individualPricePln = individualPath ? entryPricePln(event, "individual") : 0;
  const individualFeeAcer =
    individualPath && individualPricePln === 0 ? minorToAcer(individualEntryFeeMinor(event)) : 0;
  const individualFeeLabel =
    individualPricePln > 0
      ? t("detail.priceIndividual", { price: individualPricePln })
      : individualFeeAcer > 0
        ? t("detail.feeIndividual", { amount: individualFeeAcer })
        : null;
  const paidEntry = individualFeeLabel !== null;
  /**
   * Which of the state copy blocks the hero, the banner and the note read from.
   *
   * The `open` block says "free" three times — a kicker reading "free tier", a
   * banner reading "Registration is free and open", and a "Register free" CTA —
   * because until October 2026 that was simply true. On a priced night it is a
   * lie printed three times in whichever of three languages the visitor reads,
   * directly above a price. `openPaid` is the same block with those three
   * sentences told straight, so the whole hero switches on one name rather than
   * on three conditionals scattered down the page.
   *
   * Only the `open` state has a paid twin: every other state (`closed`, `full`,
   * `completed`, `cancelled`, `soon`) is about a door nobody can walk through
   * right now, and what it used to cost is not what a visitor standing in front
   * of it needs to know.
   */
  const copyState = state === "open" && paidEntry ? "openPaid" : state;
  // The event's results — imported rows or a legacy config sheet. Read at
  // build/revalidate time: this page is SSG, and the import commit revalidates
  // it, so results appear with the first mid-event import rather than waiting
  // for a redeploy. Mid-event (`closed`) they only drive the sidebar link;
  // once `completed` they render inline — this page is the event's archive.
  const results = state === "closed" || state === "completed" ? await getPublicResults(slug) : null;
  const hasResults = results !== null;
  // Published media (the `event_media` row an admin created). Same caching
  // story: the publish action revalidates this page, flipping the coming-soon
  // note into the teaser without a deploy.
  const media = state === "completed" ? await getEventMediaConfig(slug) : null;
  const docLocale = hasLocale(routing.locales, locale) ? locale : defaultLocale;
  const docs = getEventDocuments(event).flatMap((doc) => {
    const resolved = resolveDocumentFile(doc, docLocale);
    return resolved ? [{ id: doc.id, labelKey: doc.labelKey, ...resolved }] : [];
  });
  const [, m, d] = event.date.split("-");
  const longDate = formatEventLongDate(locale, event.date);
  // The window start is when check-in opens; racing begins an hour later
  // (`firstHeatTime`, the same offset the timetable below is built from).
  const startTime = await getFirstHeatTime(slug);

  /**
   * What the bottom bar on a phone offers, if anything: a bar only while
   * registration is open, and the one door every night has — the register
   * flow (ADR 0016). It is session-aware exactly like the card's, in its
   * one-button form and under the one-word label: a logged-out visitor's tap
   * lands on the register flow, which sends them through sign-up and back, so
   * "Register" is true for both.
   */
  const barCta =
    state !== "open" ? null : (
      <EventRegisterCta
        compact
        slug={slug}
        registerLabel={t("detail.register")}
        createLabel={t("detail.register")}
        signInPrompt={t("detail.cta.signInPrompt")}
        signInLabel={t("detail.cta.signIn")}
      />
    );

  return (
    <div className={barCta ? "ace-landing iv evd-page evd-page--bar" : "ace-landing iv evd-page"}>
      <InteriorHeader />
      <main className="iv-main">
        <div className="wrap">
          <Link href="/#events" className="detail-back">
            {t("detail.back")}
          </Link>

          {/* Five blocks on one grid (event-detail.css): two columns on a
              desktop with the entry card sticky on the right; one column on a
              phone, where the entry card comes straight after the hero so the
              way to register is on the first screen. */}
          <div className="evd">
            <section className="evd-hero">
              <div className="evd-hero__top">
                <span className="ev-eyebrow">{t(`detail.states.${copyState}.kicker`)}</span>
                <span className={`status status--${state}`}>
                  <span className="status__dot" />
                  {t(`status.${STATUS_KEY[state]}`)}
                </span>
              </div>
              <h2 className="detail-title">{event.name}</h2>
              <p className="detail-sub">
                <b>{longDate}</b> · {event.venue}, {event.city}
              </p>
            </section>

            <aside className="evd-entry" id="entry">
              <div className="slots-card">
                {/* One entry row, carrying the individual mile's price — the
                    only price this page prints (ADR 0016). A free night keeps
                    the row it always had. The `data-*` numbers are the
                    assertable ones — the label is translated and the price is
                    not. */}
                <div
                  className="slots-row"
                  data-event-fee-individual={individualFeeAcer}
                  data-event-price-individual={individualPricePln}
                >
                  <div className="slots-lbl">
                    <b>{t("detail.slots.entry")}</b>
                    <small>{t("detail.slots.entrySub")}</small>
                  </div>
                  {/* The price as this visitor pays it: a RED/BLACK member
                      sees "Free" and their team once the session is known
                      (`/api/me/race`); everyone else sees the night's price
                      the server rendered. Display only — the register page
                      derives the race again when the row is written. */}
                  <EntryPriceForViewer
                    className={paidEntry ? "slots-val" : "slots-val slots-val--free"}
                    freeClassName="slots-val slots-val--free"
                    freeLabel={t("detail.slots.free")}
                    teamTemplate={t("detail.slots.teamRace", { team: "{team}" })}
                  >
                    {individualFeeLabel ? <div>{individualFeeLabel}</div> : null}
                    {/* `detail.feeFree` is deliberately unused: this row has
                        said "Free" through `detail.slots.free` since the page
                        existed, and two sentences for one fact are two
                        sentences to keep in step in three languages. */}
                    {paidEntry ? null : t("detail.slots.free")}
                  </EntryPriceForViewer>
                </div>

                {/* A team event keeps its notice and the two documents a member
                    will be asked to accept, on the eventless legal route (#58)
                    so they can be read before anyone commits. Its CTA is the
                    register flow like every other night's (ADR 0016). */}
                {isTeamEvent ? (
                  <div data-team-entry-notice="1">
                    <p className="slots-note">{t("teamEvent.notice")}</p>
                    {state === "open" ? (
                      <EventRegisterCta
                        slug={slug}
                        registerLabel={t(`detail.states.${copyState}.cta`)}
                        createLabel={t("detail.cta.create")}
                        signInPrompt={t("detail.cta.signInPrompt")}
                        signInLabel={t("detail.cta.signIn")}
                      />
                    ) : null}
                    <Link
                      href="/legal/team-rules"
                      className="btn btn-stroke-dark btn-block slots-link"
                      data-team-rules-link="1"
                    >
                      {t("teamEvent.rulesLink")}
                    </Link>
                    <Link
                      href="/legal/team-regulations"
                      className="btn btn-stroke-dark btn-block slots-link"
                      data-team-regulations-link="1"
                    >
                      {t("teamEvent.regulationsLink")}
                    </Link>
                  </div>
                ) : teamPath && state === "open" ? (
                  // A mixed night, open: one door (ADR 0016). The runner does
                  // not choose a race — the register flow derives it from the
                  // roster — so the CTA is the individual night's, and four
                  // lines under it say how the two races are decided; a fifth
                  // links the Team Mile Rules paragraph (§2.2) behind them.
                  <>
                    <EventRegisterCta
                      slug={slug}
                      registerLabel={t(`detail.states.${copyState}.cta`)}
                      createLabel={t("detail.cta.create")}
                      signInPrompt={t("detail.cta.signInPrompt")}
                      signInLabel={t("detail.cta.signIn")}
                    />
                    <div className="entry-explainer" data-entry-explainer="1">
                      <p className="slots-note" data-entry-explainer-line="team">
                        {t("entryExplainer.team")}
                      </p>
                      <p className="slots-note" data-entry-explainer-line="individual">
                        {individualPricePln > 0
                          ? t("entryExplainer.individualPln", { price: individualPricePln })
                          : individualFeeAcer > 0
                            ? t("entryExplainer.individualAcer", { amount: individualFeeAcer })
                            : t("entryExplainer.individualFree")}
                      </p>
                      <p className="slots-note" data-entry-explainer-line="no-team">
                        {t("entryExplainer.noTeam")}
                      </p>
                      <p className="slots-note" data-entry-explainer-line="invite">
                        {t("entryExplainer.invite")}
                      </p>
                      <EntryRulesLink locale={locale} />
                    </div>
                  </>
                ) : state === "open" ? (
                  // The label comes from whichever state block the rest of the
                  // hero is reading, so the button cannot say "Register free"
                  // under a banner that just quoted a price.
                  <EventRegisterCta
                    slug={slug}
                    registerLabel={t(`detail.states.${copyState}.cta`)}
                    createLabel={t("detail.cta.create")}
                    signInPrompt={t("detail.cta.signInPrompt")}
                    signInLabel={t("detail.cta.signIn")}
                  />
                ) : state === "cancelled" ? (
                  // A cancelled night never offers registration — the banner
                  // above says it is off, and this points back at the nights
                  // that are still on.
                  <Link href="/#events" className="btn btn-stroke-dark btn-block">
                    {t("detail.states.cancelled.cta")}
                  </Link>
                ) : state === "completed" && hasResults ? (
                  // "View results →" points at this page's own inline results
                  // section — the archive body right below — not the landing.
                  <a href="#results" className="btn btn-stroke-dark btn-block">
                    {t("detail.states.completed.cta")}
                  </a>
                ) : state === "closed" || state === "completed" ? (
                  // Completed without results yet borrows the closed state's
                  // "pick another night" label: its own says "View results",
                  // which would lie on a link back to the events list.
                  <Link href="/#events" className="btn btn-stroke-dark btn-block">
                    {t("detail.states.closed.cta")}
                  </Link>
                ) : (
                  <button type="button" className="btn btn-stroke-dark btn-block" disabled>
                    {t("detail.states.soon.cta")}
                  </button>
                )}

                <p className="slots-note">{t(`detail.states.${copyState}.note`)}</p>

                {/* The start list, once entries have closed and the card is
                    being built. Config-derived so this page stays static: the
                    link is shown for the whole `registration_closed` window and
                    the start list itself renders its own "not published yet"
                    state until an admin publishes. */}
                {state === "closed" ? (
                  <Link
                    href={`/events/${slug}/heats`}
                    className="btn btn-stroke-dark btn-block slots-link"
                  >
                    {t("heats.cta")}
                  </Link>
                ) : null}

                {/* Results link, mid-event only (`closed`, heats are being
                    imported between rounds) — once `completed` the tables are
                    inline on this page and the primary CTA above jumps there. */}
                {hasResults && state === "closed" ? (
                  <Link
                    href={`/events/${slug}/results`}
                    className="btn btn-stroke-dark btn-block slots-link"
                  >
                    {t("results.cta")}
                  </Link>
                ) : null}
              </div>
            </aside>

            <section className="evd-facts">
              <div className="detail-facts">
                <Fact k={t("detail.facts.date")} v={`${d} ${MONTHS[Number(m) - 1] ?? m}`} />
                <Fact
                  k={t("detail.facts.venue")}
                  v={event.venue}
                  href={venueMapsUrl(event.venue, event.city)}
                />
                <Fact k={t("detail.facts.checkin")} v={event.timeRange?.start ?? "—"} />
                <Fact k={t("detail.facts.start")} v={startTime ?? "—"} />
                <Fact k={t("detail.facts.distance")} v={t("detail.distanceValue")} />
              </div>
            </section>

            <section className="evd-terms">
              <div className={`banner banner--${BANNER_TONE[state]}`}>
                <span className="banner__ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8h.01M11 12h1v4h1" strokeLinecap="round" />
                  </svg>
                </span>
                <div className="banner__body">
                  <div className="banner__title">{t(`detail.states.${copyState}.bannerTitle`)}</div>
                  <div className="banner__txt">{t(`detail.states.${copyState}.bannerTxt`)}</div>
                </div>
              </div>
            </section>

            {/* Attached files, picked to match the reader's locale: the
                regulations PDF on nights with an individual path, the team
                corpus as .docx on nights with a team path (ADR 0009). */}
            {docs.length > 0 && (
              <section className="evd-docs">
                <span className="ev-eyebrow">{t("docs.heading")}</span>
                <ul className="doc-list">
                  {docs.map((doc) => (
                    <li key={doc.id}>
                      <a className="doc-row" href={doc.file.href} target="_blank" rel="noopener">
                        <span className="doc-row__ic" aria-hidden>
                          {(doc.file.format ?? "pdf").toUpperCase()}
                        </span>
                        <span className="doc-row__body">
                          <span className="doc-row__title">{t(`docs.items.${doc.labelKey}`)}</span>
                          <span className="doc-row__meta">
                            {`${(doc.file.format ?? "pdf").toUpperCase()} · ${doc.file.lang.toUpperCase()}`}
                            {doc.isFallback ? ` · ${t("docs.fallback")}` : ""}
                          </span>
                        </span>
                        <span className="doc-row__act">
                          {t("docs.download")}
                          <span aria-hidden> ↓</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* The archive body — only on completed events: results first,
              gallery preview second. */}
          {state === "completed" && results ? (
            <section className="detail-results" id="results" data-detail-results>
              <span className="ev-eyebrow">{t("results.eyebrow")}</span>
              <ResultsTables results={results} />
              <p className="iv-meta">
                <a
                  className="iv-extlink"
                  href={RACE_RESULT_GROUP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("results.raceResult")}
                  <span aria-hidden="true"> ↗</span>
                </a>
              </p>
              {/* The gallery is the other half of the archive view; a reader
                  who came for the times should not have to scroll to find
                  the photos. Only once one is published. */}
              {media ? (
                <p className="iv-meta">
                  <Link
                    href={`/events/${slug}/gallery`}
                    className="iv-extlink"
                    data-results-gallery-link
                  >
                    {t("media.fromResults")}
                  </Link>
                </p>
              ) : null}
            </section>
          ) : null}

          {/* Media section — only on completed events. Published (an
              `event_media` row exists): a teaser strip into the gallery.
              Completed without a row: a coming-soon note. Non-completed
              states render nothing. */}
          {state === "completed" &&
            (media ? (
              <EventMediaTeaser
                slug={slug}
                folderId={media.driveFolderId}
                heading={t("media.teaserHeading")}
                viewAll={t("media.viewAll")}
                videoCount={(count) => t("media.videoCount", { count })}
                comingSoon={t("media.comingSoon")}
              />
            ) : (
              <section className="media-soon">
                <span className="ev-eyebrow">{t("media.teaserHeading")}</span>
                <p className="media-soon__txt">{t("media.comingSoon")}</p>
                <Link href="/gallery" className="media-soon__link">
                  {t("media.browseOthers")}
                </Link>
              </section>
            ))}
        </div>
      </main>

      {/* Phones only (event-detail.css): the CTA follows the reader down the
          page once the entry card has scrolled off. */}
      {barCta ? (
        <StickyEntryBar watchId="entry">
          <div className="evd-bar__price">
            <span className="evd-bar__k">{t("detail.slots.entry")}</span>
            {/* The individual mile's price — the only one this page prints
                (ADR 0016). */}
            <EntryPriceForViewer
              className="evd-bar__viewer"
              freeClassName="evd-bar__v evd-bar__v--free"
              freeLabel={t("detail.slots.free")}
            >
              {paidEntry ? (
                <>
                  {individualFeeLabel ? (
                    <span className="evd-bar__v">{individualFeeLabel}</span>
                  ) : null}
                </>
              ) : (
                <span className="evd-bar__v evd-bar__v--free">{t("detail.slots.free")}</span>
              )}
            </EntryPriceForViewer>
          </div>
          <div className="evd-bar__cta">{barCta}</div>
        </StickyEntryBar>
      ) : null}
    </div>
  );
}

/** A key/value cell. With `href` the value becomes an external link (the venue
 *  opens the venue on Google Maps). */
function Fact({ k, v, href }: { k: string; v: string; href?: string }) {
  return (
    <div className="fact">
      <div className="fact__k">{k}</div>
      <div className="fact__v">
        {href ? (
          <a className="fact__link" href={href} target="_blank" rel="noopener noreferrer">
            {v}
          </a>
        ) : (
          v
        )}
      </div>
    </div>
  );
}
