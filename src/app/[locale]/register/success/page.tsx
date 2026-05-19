import { setRequestLocale } from "next-intl/server";

import { Footer } from "@/components/marketing/footer";
import { Header } from "@/components/marketing/header";
import { Container } from "@/components/ui/container";
import { LinkButton } from "@/components/ui/button";
import { getRegistrationCounters } from "@/features/registration/data";

type SuccessSearch = {
  flow?: string;
  code?: string;
  payment?: string;
  checkout?: string;
};

export default async function SuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SuccessSearch>;
}) {
  const { locale } = await params;
  const search = await searchParams;
  setRequestLocale(locale);
  const counters = await getRegistrationCounters();
  const isCheckout = Boolean(search.checkout);

  return (
    <>
      <Header remaining={counters.freeSlotsRemaining} total={counters.freeSlotsTotal} />
      <main className="bg-bg-2 py-8 md:py-12">
        <Container className="max-w-3xl">
          <section className="border border-ink bg-bg">
            <div className="border-b border-ink p-5 md:p-7">
              <span className="eyebrow eyebrow-red">Registration complete</span>
              <h1 className="shout shout-md mt-3">
                {isCheckout ? "Payment received." : "You are in."}
              </h1>
              <p className="mt-4 max-w-prose text-muted">
                {isCheckout
                  ? "Payment confirmed. Your email is on the way."
                  : successCopy(search.flow)}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 md:p-7">
              {search.code ? (
                <div className="border border-accent bg-accent p-5 text-white md:col-span-2">
                  <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/70">
                    Team code
                  </div>
                  <div className="mt-2 break-all font-display text-[clamp(32px,7vw,58px)] font-black italic uppercase leading-none">
                    {search.code}
                  </div>
                  <p className="mt-3 text-sm text-white/80">
                    Share this code with teammates.
                  </p>
                </div>
              ) : null}
              <Info label="Payment" value={paymentLabel(search.payment, isCheckout)} />
              <Info label="Magic link" value="Sent by email" />
              <Info label="Free slots left" value={String(counters.freeSlotsRemaining)} />
              <Info label="Teams forming" value={String(counters.teamsFormed)} />
            </div>

            <div className="flex flex-col gap-3 border-t border-line p-5 sm:flex-row md:p-7">
              {search.code ? (
                <LinkButton href={`/join/${search.code}`} intent="primary">
                  Open invite link
                </LinkButton>
              ) : null}
              <LinkButton href="/" intent={search.code ? "ghost" : "primary"}>
                Back to landing
              </LinkButton>
            </div>
          </section>
        </Container>
      </main>
      <Footer />
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line bg-bg-2 p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">{label}</div>
      <div className="mt-1 font-display-alt font-semibold">{value}</div>
    </div>
  );
}

function successCopy(flow?: string) {
  if (flow === "start") return "Your team is live.";
  if (flow === "free") return "You are registered as a free runner.";
  if (flow === "solo") return "Your solo entry is confirmed.";
  if (flow === "join") return "You have joined the team.";
  return "Registration received.";
}

function paymentLabel(payment?: string, isCheckout?: boolean) {
  if (isCheckout) return "Paid via Stripe";
  if (payment === "free") return "Free runner slot claimed";
  if (payment === "paid") return "Paid";
  return "Pending";
}
