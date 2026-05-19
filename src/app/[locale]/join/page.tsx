import { setRequestLocale } from "next-intl/server";

import { Footer } from "@/components/marketing/footer";
import { Header } from "@/components/marketing/header";
import { Container } from "@/components/ui/container";
import { JoinCodeForm } from "@/features/registration/components/join-code-form";
import { getRegistrationCounters } from "@/features/registration/data";

export default async function JoinPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const counters = await getRegistrationCounters();

  return (
    <>
      <Header remaining={counters.freeSlotsRemaining} total={counters.freeSlotsTotal} />
      <main className="bg-bg-2 py-8 md:py-12">
        <Container className="max-w-2xl">
          <JoinCodeForm />
        </Container>
      </main>
      <Footer />
    </>
  );
}
