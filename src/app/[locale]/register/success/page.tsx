import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";

import "@/app/landing.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { Link } from "@/i18n/navigation";
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
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap">
          <section className="iv-card">
            <span className="iv-eyebrow">{t("eyebrow")}</span>
            <h1 className="iv-title">{isCheckout ? t("paymentReceived") : t("youAreIn")}</h1>
            <p className="iv-sub">{isCheckout ? t("checkout") : successCopy(search.flow, t)}</p>

            {search.code ? (
              <div className="iv-share">
                <span className="iv-eyebrow" style={{ color: "rgba(255,255,255,0.8)" }}>
                  {t("teamCode")}
                </span>
                <div className="iv-share__code">{search.code}</div>
                <p style={{ marginTop: 12, color: "rgba(255,255,255,0.9)" }}>{t("shareCode")}</p>
              </div>
            ) : null}

            <div className="iv-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
              <Info label={t("payment")} value={paymentLabel(search.payment, isCheckout, t)} />
              <Info label={t("magicLink")} value={t("magicSent")} />
              <Info label={t("freeSlotsLeft")} value={String(counters.freeSlotsRemaining)} />
              <Info label={t("teamsForming")} value={String(counters.teamsFormed)} />
            </div>

            <div className="iv-actions">
              {search.code ? (
                <Link href={`/join/${search.code}`} className="btn btn-red">
                  {t("openInvite")}
                </Link>
              ) : null}
              <Link href="/" className={search.code ? "btn btn-stroke" : "btn btn-red"}>
                {common("backToLanding")}
              </Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="iv-info">
      <div className="iv-info__label">{label}</div>
      <div className="iv-info__value">{value}</div>
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
