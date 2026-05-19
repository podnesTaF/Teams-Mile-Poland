import { setRequestLocale } from "next-intl/server";

import { Footer } from "@/components/marketing/footer";
import { Header } from "@/components/marketing/header";
import { RegistrationForm } from "@/features/registration/components/registration-form";
import { RegistrationShell } from "@/features/registration/components/registration-shell";
import { getRegistrationCounters } from "@/features/registration/data";

export default async function FreeRunnerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const counters = await getRegistrationCounters();

  return (
    <>
      <Header remaining={counters.freeSlotsRemaining} total={counters.freeSlotsTotal} />
      <RegistrationShell
        title="Find me a team."
        intro="Register now. We match you with an open team later."
        counters={counters}
        raceBlock="Pending team assignment"
        raceNote="We email you when matched."
      >
        <RegistrationForm flow="free" />
      </RegistrationShell>
      <Footer />
    </>
  );
}
