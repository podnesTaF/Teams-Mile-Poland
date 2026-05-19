import { setRequestLocale } from "next-intl/server";

import { Footer } from "@/components/marketing/footer";
import { Header } from "@/components/marketing/header";
import { RegistrationForm } from "@/features/registration/components/registration-form";
import { RegistrationShell } from "@/features/registration/components/registration-shell";
import { getRegistrationCounters } from "@/features/registration/data";

export default async function SoloPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const counters = await getRegistrationCounters();

  return (
    <>
      <Header remaining={counters.freeSlotsRemaining} total={counters.freeSlotsTotal} />
      <RegistrationShell
        title="Run solo."
        intro="Run the morning rating mile."
        counters={counters}
        raceBlock="10:30-12:00 individual mile"
        raceNote="Official ranking time."
      >
        <RegistrationForm flow="solo" />
      </RegistrationShell>
      <Footer />
    </>
  );
}
