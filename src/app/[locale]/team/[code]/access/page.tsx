import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";

import "@/app/landing.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { AccessForm } from "@/features/team/components/access-form";
import { normalizeTeamCode } from "@/features/team/data";

type AccessSearch = {
  sent?: string;
  error?: string;
  rotated?: string;
};

export default async function TeamAccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; code: string }>;
  searchParams: Promise<AccessSearch>;
}) {
  const { locale, code: rawCode } = await params;
  const search = await searchParams;
  setRequestLocale(locale);

  const code = normalizeTeamCode(decodeURIComponent(rawCode));
  const t = await getTranslations("team.access");

  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap iv-wrap--narrow">
          {search.sent ? (
            <section className="iv-card">
              <span className="iv-eyebrow">{t("sentTitle")}</span>
              <p className="iv-sub">{t("sentBody")}</p>
            </section>
          ) : (
            <>
              {search.rotated ? <Notice tone="info" body={t("rotatedNotice")} /> : null}
              {search.error === "email" ? <Notice tone="error" body={t("errors.email")} /> : null}
              {search.error === "invalid" ? <Notice tone="error" body={t("errors.invalid")} /> : null}
              {search.error === "expired" ? <Notice tone="error" body={t("errors.expired")} /> : null}
              {search.error === "used" ? <Notice tone="error" body={t("errors.used")} /> : null}
              <AccessForm code={code} locale={locale} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Notice({ tone, body }: { tone: "info" | "error"; body: string }) {
  return <div className={`iv-notice iv-notice--${tone}`}>{body}</div>;
}
