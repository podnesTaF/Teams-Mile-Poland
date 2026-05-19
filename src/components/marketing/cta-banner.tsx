import { useTranslations } from "next-intl";

import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Link } from "@/i18n/navigation";

export function CtaBanner() {
  const t = useTranslations("cta");

  return (
    <section className="bg-accent py-24 text-white">
      <Container className="text-center">
        <Eyebrow tone="light">{t("eyebrow")}</Eyebrow>
        <div className="my-5 shout shout-lg text-white">
          {t("line1")}
          <br />
          {t("line2")}
          <br />
          <span className="text-ink">{t("line3")}</span>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-2.5">
          <Link
            href="/register"
            className="inline-flex h-14 items-center justify-center gap-2 bg-ink px-7 font-display-alt text-[15px] font-semibold uppercase tracking-[0.06em] text-white transition-colors hover:bg-ink-2"
          >
            {t("button")}
            <span aria-hidden>→</span>
          </Link>
        </div>
      </Container>
    </section>
  );
}
