import "@/app/landing.css";

import { Atmosphere } from "@/components/landing/atmosphere";
import { Audience } from "@/components/landing/audience";
import { Contact } from "@/components/landing/contact";
import { Faq } from "@/components/landing/faq";
import { FinalCta } from "@/components/landing/final-cta";
import { Formats } from "@/components/landing/formats";
import { Hero } from "@/components/landing/hero";
import { HowItGoes } from "@/components/landing/how-it-goes";
import { Invite } from "@/components/landing/invite";
import { Location } from "@/components/landing/location";
import { PathForward } from "@/components/landing/path";
import { Program } from "@/components/landing/program";
import { WhatIs } from "@/components/landing/what-is";

/**
 * The full landing section tree. Rendered both by the locale page
 * (`[locale]/page.tsx`) and by the children-slot fallback
 * (`[locale]/default.tsx`) — the latter ensures the landing stays
 * behind the registration modal when its route is intercepted by the
 * `@modal` parallel slot.
 */
export function LandingView() {
  return (
    <div className="ace-landing">
      <Hero />
      <WhatIs />
      <HowItGoes />
      <Invite />
      <Audience />
      <Location />
      <Formats />
      <PathForward />
      <Atmosphere />
      <Program />
      <Faq />
      <Contact />
      <FinalCta />
    </div>
  );
}
