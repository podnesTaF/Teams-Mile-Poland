import { useTranslations } from "next-intl";

import { HashLink } from "@/components/ui/hash-link";

/** Compact mid-page band — reuses the hero primary register label. */
export function RegisterCta({ href = "/register" }: { href?: string }) {
  const t = useTranslations("landing.hero");

  return (
    <section className="section register-cta" aria-label="Register">
      <div className="wrap center">
        <HashLink href={href} className="btn btn-red">
          {t("ctaPrimary")}
        </HashLink>
      </div>
    </section>
  );
}
