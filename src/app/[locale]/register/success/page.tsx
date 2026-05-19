import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";

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
  const t = await getTranslations("registration.success");
  const common = await getTranslations("common");

  return (
    <>
      <Header remaining={counters.freeSlotsRemaining} total={counters.freeSlotsTotal} />
      <main className="bg-bg-2 py-8 md:py-12">
        <Container className="max-w-3xl">
          <section className="border border-ink bg-bg">
            <div className="border-b border-ink p-5 md:p-7">
              <span className="eyebrow eyebrow-red">{t("eyebrow")}</span>
              <h1 className="shout shout-md mt-3">
                {isCheckout ? t("paymentReceived") : t("youAreIn")}
              </h1>
              <p className="mt-4 max-w-prose text-muted">
                {isCheckout
                  ? t("checkout")
                  : successCopy(search.flow, t)}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 md:p-7">
              {search.code ? (
                <div className="border border-accent bg-accent p-5 text-white md:col-span-2">
                  <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/70">
                    {t("teamCode")}
                  </div>
                  <div className="mt-2 break-all font-display text-[clamp(32px,7vw,58px)] font-black italic uppercase leading-none">
                    {search.code}
                  </div>
                  <p className="mt-3 text-sm text-white/80">
                    {t("shareCode")}
                  </p>
                </div>
              ) : null}
              <Info label={t("payment")} value={paymentLabel(search.payment, isCheckout, t)} />
              <Info label={t("magicLink")} value={t("magicSent")} />
              <Info label={t("freeSlotsLeft")} value={String(counters.freeSlotsRemaining)} />
              <Info label={t("teamsForming")} value={String(counters.teamsFormed)} />
            </div>

            <div className="flex flex-col gap-3 border-t border-line p-5 sm:flex-row md:p-7">
              {search.code ? (
                <LinkButton href={`/join/${search.code}`} intent="primary">
                  {t("openInvite")}
                </LinkButton>
              ) : null}
              <LinkButton href="/" intent={search.code ? "ghost" : "primary"}>
                {common("backToLanding")}
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

function successCopy(flow: string | undefined, t: Awaited<ReturnType<typeof getTranslations>>) {
  if (flow === "start") return t("start");
  if (flow === "free") return t("free");
  if (flow === "solo") return t("solo");
  if (flow === "join") return t("join");
  return t("fallback");
}

function paymentLabel(
  payment: string | undefined,
  isCheckout: boolean | undefined,
  t: Awaited<ReturnType<typeof getTranslations>>,
) {
  if (isCheckout) return t("paymentLabels.checkout");
  if (payment === "free") return t("paymentLabels.free");
  if (payment === "paid") return t("paymentLabels.paid");
  return t("paymentLabels.pending");
}
