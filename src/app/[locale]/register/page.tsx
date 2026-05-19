import { setRequestLocale } from "next-intl/server";

import { Footer } from "@/components/marketing/footer";
import { Header } from "@/components/marketing/header";
import { PathPicker } from "@/components/marketing/path-picker";
import { Container } from "@/components/ui/container";
import { getRegistrationCounters } from "@/features/registration/data";
import { EVENT } from "@/lib/marketing/event";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const counters = await getRegistrationCounters();

  return (
    <>
      <Header
        remaining={counters.freeSlotsRemaining}
        total={counters.freeSlotsTotal}
      />
      <main className="bg-bg-2 py-8 md:py-12">
        <Container>
          <section className="border border-ink bg-bg">
            <div className="border-b border-ink p-5 md:p-7">
              <span className="eyebrow eyebrow-red">Registration</span>
              <h1 className="shout shout-md mt-3">
                Choose your path.
              </h1>
              <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted md:text-base">
                {EVENT.freeTier.pricePln} PLN per runner. First{" "}
                {EVENT.freeTier.total} registered runners go free.
              </p>
            </div>
            <div className="p-5 md:p-7">
              <PathPicker />
            </div>
          </section>
        </Container>
      </main>
      <Footer />
    </>
  );
}
