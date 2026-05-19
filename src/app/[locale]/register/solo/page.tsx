import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";

import { Footer } from "@/components/marketing/footer";
import { Header } from "@/components/marketing/header";
import { RegistrationForm } from "@/features/registration/components/registration-form";
import { RegistrationShell } from "@/features/registration/components/registration-shell";
import { getRegistrationCounters } from "@/features/registration/data";

export default async function SoloPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const counters = await getRegistrationCounters();
  const t = await getTranslations("registration.solo");

  return (
    <>
      <Header remaining={counters.freeSlotsRemaining} total={counters.freeSlotsTotal} />
      <RegistrationShell
        title={t("title")}
        intro={t("intro")}
        counters={counters}
        raceBlock={t("block")}
        raceNote={t("note")}
      >
        <RegistrationForm flow="solo" />
      </RegistrationShell>
      <Footer />
    </>
  );
}
