import { setRequestLocale } from "next-intl/server";

import { Footer } from "@/components/marketing/footer";
import { Header } from "@/components/marketing/header";
import { RegistrationForm } from "@/features/registration/components/registration-form";
import { RegistrationShell } from "@/features/registration/components/registration-shell";
import { getRegistrationCounters } from "@/features/registration/data";

export default async function StartTeamPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const counters = await getRegistrationCounters();

  return (
    <>
      <Header remaining={counters.freeSlotsRemaining} total={counters.freeSlotsTotal} />
      <RegistrationShell
        title="Start a team."
        intro="Create a team and get a shareable code."
        counters={counters}
        raceBlock="Team mile"
        raceNote="Afternoon team block."
      >
        <RegistrationForm flow="start" />
      </RegistrationShell>
      <Footer />
    </>
  );
}
