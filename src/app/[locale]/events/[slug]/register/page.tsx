import { getTranslations, setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "@/app/series-flows.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { EventRegisterContent } from "@/features/event-registration/components/event-register-content";
import { Link } from "@/i18n/navigation";

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ payment?: string | string[] }>;
};

export default async function EventRegisterPage({ params, searchParams }: PageProps) {
  const { locale, slug } = await params;
  const { payment } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("register");

  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap">
          <Link href={`/events/${slug}`} className="detail-back">
            ← {t("confirm.back")}
          </Link>
          <EventRegisterContent
            slug={slug}
            locale={locale}
            payment={typeof payment === "string" ? payment : undefined}
          />
        </div>
      </main>
    </div>
  );
}
