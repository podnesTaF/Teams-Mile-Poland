import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";

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
  const t = await getTranslations("landing");

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
            eyebrow={t("register.eyebrow")}
            title={
              <>
                {t("register.titleA")}
                <br />
                {t("register.titleB")}
              </>
            }
            description={t("register.description", {
              price: EVENT.freeTier.pricePln,
              total: EVENT.freeTier.total,
            })}
          />
          <PathPicker />
        </Section>

        <Section id="sport">
          <SectionHead
            eyebrow={t("sport.eyebrow")}
            title={
              <>
                {t("sport.titleA")}
                <br />
                {t("sport.titleB")}
              </>
            }
            description={t("sport.description")}
          />
          <NormalVsTeams teamsVideoId="zKlnB1buY4E" />

          <div className="mt-16">
            <div className="mb-3 flex items-center justify-between">
              <span className="eyebrow">{t("sport.rolesLabel")}</span>
              <Link
                href="/#documents"
                className="border-b border-current text-sm font-medium text-ink"
              >
                {t("sport.rulesLink")}
              </Link>
            </div>
            <RoleCards />
          </div>
        </Section>

        <Section id="schedule" tone="muted">
          <SectionHead
            eyebrow={t("schedule.eyebrow", {
              date: locale === "pl" ? EVENT.dateLabel.pl : EVENT.dateLabel.en,
            })}
            title={
              <>
                {t("schedule.titleA")}
                <br />
                {t("schedule.titleB")}
              </>
            }
            description={t("schedule.description")}
          />
          <ScheduleList />
        </Section>

        <Section id="venue" tone="muted">
          <Venue />
        </Section>

        <Section id="documents">
          <SectionHead
            eyebrow={t("documents.eyebrow")}
            title={
              <>
                {t("documents.titleA")}
                <br />
                {t("documents.titleB")}
              </>
            }
            description={t("documents.description")}
          />
          <Documents locale={locale === "pl" ? "pl" : "en"} />
        </Section>

        <Section id="faq">
          <SectionHead
            eyebrow={t("faq.eyebrow")}
            title={
              <>
                {t("faq.titleA")}
                <br />
                {t("faq.titleB")}
              </>
            }
            description={
              <>
                {t("faq.description")}
                <a
                  href="mailto:info@acebattle.run"
                  className="border-b border-current text-ink"
                >
                  info@acebattle.run
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
