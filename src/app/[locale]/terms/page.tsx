import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { Link } from "@/i18n/navigation";

type Section = {
  h: string;
  /** Paragraphs shown before the optional bullet list. */
  p?: string[];
  /** Plain bullet points. */
  list?: string[];
  /** Paragraphs shown after the bullet list. */
  outro?: string[];
};

type LegalDoc = {
  title: string;
  updated: string;
  intro: string;
  sections: Section[];
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

  const documents = t.raw("documents") as LegalDoc[];

  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap">
          <span className="iv-eyebrow">{t("eyebrow")}</span>
          <h1 className="iv-title">{t("title")}</h1>

          {documents.map((doc, di) => (
            <section className="iv-doc" key={di}>
              <h2 className="iv-doc__title">{doc.title}</h2>
              <p className="iv-meta">{doc.updated}</p>
              <p className="iv-sub" style={{ maxWidth: "75ch" }}>
                {doc.intro}
              </p>

              <div className="iv-legal">
                {doc.sections.map((section, i) => (
                  <section className="iv-legal__sec" key={i}>
                    <h3>{section.h}</h3>
                    {section.p?.map((para, j) => (
                      <p key={j}>{para}</p>
                    ))}
                    {section.list ? (
                      <ul className="iv-legal__list">
                        {section.list.map((item, j) => (
                          <li key={j}>{item}</li>
                        ))}
                      </ul>
                    ) : null}
                    {section.outro?.map((para, j) => (
                      <p key={j}>{para}</p>
                    ))}
                  </section>
                ))}
              </div>
            </section>
          ))}

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
