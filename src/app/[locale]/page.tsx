import { setRequestLocale } from "next-intl/server";

import { Header } from "@/components/marketing/header";
import { Footer } from "@/components/marketing/footer";
import { Hero } from "@/components/marketing/hero";
import { PathPicker } from "@/components/marketing/path-picker";
import { NormalVsTeams } from "@/components/marketing/normal-vs-teams";
import { RoleCards } from "@/components/marketing/role-cards";
import { ScheduleList } from "@/components/marketing/schedule-list";
import { Venue } from "@/components/marketing/venue";
import { Documents } from "@/components/marketing/documents";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { CtaBanner } from "@/components/marketing/cta-banner";
import { Section, SectionHead } from "@/components/ui/section";
import { getRegistrationCounters } from "@/features/registration/data";
import { Link } from "@/i18n/navigation";
import { EVENT } from "@/lib/marketing/event";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const counters = await getRegistrationCounters();

  return (
    <>
      <Header remaining={counters.freeSlotsRemaining} total={counters.freeSlotsTotal} />

      <main className="flex-1">
        <Hero
          remaining={counters.freeSlotsRemaining}
          total={counters.freeSlotsTotal}
          teamsFormed={counters.teamsFormed}
        />

        <Section id="register" tone="muted">
          <SectionHead
            eyebrow="Pick your path"
            title={
              <>
                Four ways in.
                <br />
                One race day.
              </>
            }
            description={`${EVENT.freeTier.pricePln} PLN per runner. First ${EVENT.freeTier.total} registered runners go free.`}
          />
          <PathPicker />
        </Section>

        <Section id="sport">
          <SectionHead
            eyebrow="The sport · in 60 seconds"
            title={
              <>
                It&apos;s a mile.
                <br />
                But not the mile you know.
              </>
            }
            description="A one-mile team race with role-switching and a baton hand-off."
          />
          <NormalVsTeams />

          <div className="mt-16">
            <div className="mb-3 flex items-center justify-between">
              <span className="eyebrow">Three roles · one team</span>
              <Link
                href="/rules"
                className="border-b border-current text-sm font-medium text-ink"
              >
                Full rules &amp; ratings →
              </Link>
            </div>
            <RoleCards />
          </div>
        </Section>

        <Section id="schedule" tone="muted">
          <SectionHead
            eyebrow={`Race day · ${EVENT.dateLabel.en}`}
            title={
              <>
                One day.
                <br />
                Two race blocks.
              </>
            }
            description="Individual mile in the morning. Team races after lunch."
          />
          <ScheduleList />
        </Section>

        <Section id="venue" tone="muted">
          <Venue />
        </Section>

        <Section id="documents">
          <SectionHead
            eyebrow="Official documents"
            title={
              <>
                Read before
                <br />
                you toe the line.
              </>
            }
            description="Regulations, rating rules, and event documents."
          />
          <Documents locale={locale === "pl" ? "pl" : "en"} />
        </Section>

        <Section id="faq">
          <SectionHead
            eyebrow="FAQ"
            title={
              <>
                Most of what
                <br />
                runners ask.
              </>
            }
            description={
              <>
                Questions? Email{" "}
                <a
                  href="mailto:warsaw@acebattle.run"
                  className="border-b border-current text-ink"
                >
                  warsaw@acebattle.run
                </a>
              </>
            }
          />
          <FaqAccordion />
        </Section>

        <CtaBanner />
      </main>

      <Footer />
    </>
  );
}
