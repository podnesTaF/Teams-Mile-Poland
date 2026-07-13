import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { applyUnsubscribe } from "@/features/event-mailings/unsubscribe";
import { Link } from "@/i18n/navigation";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "unsubscribe" });
  return { title: t("metaTitle") };
}

export default async function UnsubscribePage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { token } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations("unsubscribe");
  const common = await getTranslations("common");

  const rawToken = typeof token === "string" ? token : "";
  const ok = rawToken ? (await applyUnsubscribe(rawToken)) === "ok" : false;

  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap iv-wrap--narrow">
          <span className="iv-eyebrow">{t("eyebrow")}</span>
          <h1 className="iv-title">{ok ? t("successTitle") : t("errorTitle")}</h1>
          <p className="iv-sub" style={{ maxWidth: "60ch" }}>
            {ok ? t("successBody") : t("errorBody")}
          </p>
          <div className="iv-actions" style={{ marginTop: 32 }}>
            <Link href="/" className="btn btn-red">
              {common("backToLanding")}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
