import "@/app/landing.css";
import "@/app/series-flows.css";

import { Archive } from "@/components/landing/archive";
import { Atmosphere } from "@/components/landing/atmosphere";
import { Audience } from "@/components/landing/audience";
import { Contact } from "@/components/landing/contact";
import { CookieConsent } from "@/components/landing/cookie-consent";
import { EventSeries } from "@/components/landing/event-series";
import { Faq } from "@/components/landing/faq";
import { FinalCta } from "@/components/landing/final-cta";
import { Formats } from "@/components/landing/formats";
import { Hero } from "@/components/landing/hero";
import { HowItGoes } from "@/components/landing/how-it-goes";
import { InternationalAssociation } from "@/components/landing/international-association";
import { LandingHeader } from "@/components/landing/landing-header";
import { LatestNews } from "@/components/landing/latest-news";
import { Location } from "@/components/landing/location";
import { Parallax } from "@/components/landing/parallax";
import { PathForward } from "@/components/landing/path";
// import { Program } from "@/components/landing/program";
import { RatingPath } from "@/components/landing/rating-path";
import { RegisterCta } from "@/components/landing/register-cta";
import { Results } from "@/components/landing/results";
import { Roles } from "@/components/landing/roles";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { WhatIs } from "@/components/landing/what-is";
import { getArchiveEvents, getPublishedMedia } from "@/lib/events/media-config";
import { getFeaturedEvent, isRegistrationOpen } from "@/lib/events/registry";
import { getResultsEventsWithDb } from "@/lib/events/results-data";

/**
 * The full landing section tree. Rendered both by the locale page
 * (`[locale]/page.tsx`) and by the children-slot fallback
 * (`[locale]/default.tsx`) — the latter ensures the landing stays
 * behind the registration modal when its route is intercepted by the
 * `@modal` parallel slot.
 */
export async function LandingView() {
  const featuredEvent = getFeaturedEvent();
  // DB-first: timing imports overlay (or replace) the config results sheets.
  const resultsEvents = await getResultsEventsWithDb();
  // The archive: completed individual events, with published-gallery covers
  // overlaid from the `event_media` table (one batch read, no Drive calls).
  const archiveEvents = getArchiveEvents();
  const archiveMedia = await getPublishedMedia(archiveEvents.map((e) => e.slug));
  const registrationOpen = isRegistrationOpen(featuredEvent);
  // Individual events register on their own detail page; the legacy team event
  // keeps the /register modal flow. Drives the hero + mid-page CTAs.
  const featuredIsIndividual = featuredEvent?.eventType === "individual";
  // Main-page "Register" leads to the events list so the visitor picks a race
  // night first, then registers from its detail page. (The legacy team event
  // keeps its own /register modal flow.)
  const registerHref = featuredIsIndividual ? "/#events" : "/register";
  // The "start a team / join a team" cards belong to the legacy team flow only.
  // For an individual featured event the EventSeries cards are the entry point.
  const showTeamFormats = registrationOpen && !featuredIsIndividual;

  return (
    <div className="ace-landing reveal-ready">
      {/* Without JS, reveal everything so content is never stuck hidden. */}
      <noscript>
        <style>
          {".ace-landing .wrap > * { opacity: 1 !important; transform: none !important; }"}
        </style>
      </noscript>
      <ScrollReveal />
      <Parallax />
      <LandingHeader registrationOpen={registrationOpen} registerHref={registerHref} />
      <Hero
        registrationOpen={registrationOpen}
        hasResults={resultsEvents.length > 0}
        registerHref={registerHref}
        nextEventDate={featuredEvent?.date ?? null}
      />
      <EventSeries />
      <LatestNews />
      {resultsEvents.length > 0 && <Results events={resultsEvents} />}
      {archiveEvents.length > 0 && <Archive events={archiveEvents} media={archiveMedia} />}
      {showTeamFormats && <Formats />}
      <WhatIs />
      <RatingPath />
      {registrationOpen && <RegisterCta href={registerHref} />}
      <HowItGoes />
      <Roles registerHref={registerHref} />
      <Audience />
      <Location />
      <PathForward />
      <Atmosphere />
      {registrationOpen && <RegisterCta href={registerHref} />}
      {/* <Program /> */}
      <InternationalAssociation />
      <Contact />
      <Faq />
      <FinalCta
        registrationOpen={registrationOpen}
        nextEventDate={featuredEvent?.date ?? null}
        registerHref={registerHref}
      />
      <CookieConsent />
    </div>
  );
}
