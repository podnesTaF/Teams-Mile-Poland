import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { Link } from "@/i18n/navigation";

type Section = {
  h: string;
  p?: string[];
  items?: { t: string; d: string }[];
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "terms" });
  return { title: t("metaTitle") };
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("terms");
  const common = await getTranslations("common");

  const sections = t.raw("sections") as Section[];

  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap">
          <span className="iv-eyebrow">{t("eyebrow")}</span>
          <h1 className="iv-title">{t("title")}</h1>
          <p className="iv-meta">{t("updated")}</p>
          <p className="iv-sub" style={{ maxWidth: "75ch" }}>
            {t("intro")}
          </p>

          <div className="iv-legal">
            {sections.map((section, i) => (
              <section className="iv-legal__sec" key={i}>
                <h2>{section.h}</h2>
                {section.p?.map((para, j) => (
                  <p key={j}>{para}</p>
                ))}
                {section.items ? (
                  <ul className="iv-legal__data">
                    {section.items.map((item, j) => (
                      <li key={j}>
                        <strong>{item.t}</strong>
                        <span>{item.d}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          <div className="iv-actions" style={{ marginTop: 40 }}>
            <Link href="/" className="btn btn-red">
              {common("backToLanding")}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
