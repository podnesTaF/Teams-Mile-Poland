import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

/** Compact mid-page band — reuses the hero primary register label. */
export function RegisterCta() {
  const t = useTranslations("landing.hero");

  return (
    <section className="section register-cta" aria-label="Register">
      <div className="wrap center">
        <Link href="/register" className="btn btn-red">
          {t("ctaPrimary")}
        </Link>
      </div>
    </section>
  );
}
