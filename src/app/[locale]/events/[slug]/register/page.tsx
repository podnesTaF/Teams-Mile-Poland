import { getTranslations, setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { EventRegisterContent } from "@/features/event-registration/components/event-register-content";
import { Link } from "@/i18n/navigation";

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function EventRegisterPage({ params }: PageProps) {
  const { locale, slug } = await params;
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
          <EventRegisterContent slug={slug} locale={locale} />
        </div>
      </main>
    </div>
  );
}
