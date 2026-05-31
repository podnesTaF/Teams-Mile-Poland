import Image from "next/image";
import { useTranslations } from "next-intl";

import { Chip } from "@/components/ui/chip";
import { Container } from "@/components/ui/container";
import { Link } from "@/i18n/navigation";
import { EVENT } from "@/lib/marketing/event";

import { ScarcityPanel } from "./scarcity-panel";

type HeroProps = {
  remaining?: number;
  total?: number;
  teamsFormed?: number;
};

export function Hero({ remaining, total, teamsFormed }: HeroProps) {
  const t = useTranslations("hero");

  return (
    <section className="relative overflow-hidden pb-8 pt-14">
      <Container>
        <div className="grid grid-cols-1 items-end gap-9 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
          <div>
            <div className="mb-8 flex flex-wrap gap-2">
              <Chip mono>{EVENT.shortDate}</Chip>
              <Chip mono>
                {EVENT.venue.name} · {EVENT.venue.city}
              </Chip>
              <Chip intent="red">{t("chipLaunch")}</Chip>
            </div>

            <h1>
              {t("headlineTop")}
              <br />
              <span className="text-accent">{t("headlineAccent")}</span>
            </h1>

            <p className="mt-7 max-w-[44ch] text-base leading-relaxed text-muted md:text-lg">
              {t("subhead")}
            </p>

            <div className="mt-9 flex flex-wrap gap-2.5">
              <Link
                href="/register"
                className="inline-flex h-14 items-center justify-center gap-2 bg-accent px-7 font-display-alt text-[15px] font-semibold uppercase tracking-[0.06em] text-white transition-colors hover:bg-[#b8302a] active:translate-y-px"
              >
                {t("ctaPrimary")}
                <span aria-hidden>→</span>
              </Link>
              <a
                href="#sport"
                className="inline-flex h-14 items-center justify-center gap-2 border border-ink bg-transparent px-7 font-display-alt text-[15px] font-semibold uppercase tracking-[0.06em] text-ink transition-colors hover:bg-ink hover:text-bg"
              >
                {t("ctaSecondary")}
              </a>
            </div>

            <dl className="mt-9 grid grid-cols-3 border-t-2 border-ink">
              <div className="border-r border-line py-[18px] pr-3">
                <dt className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  {t("stats.distance")}
                </dt>
                <dd className="font-display-alt text-base font-semibold tracking-tight md:text-lg">
                  {t("stats.distanceValue")}
                </dd>
              </div>
              <div className="border-r border-line py-[18px] pl-[18px] pr-3">
                <dt className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  {t("stats.teamSize")}
                </dt>
                <dd className="font-display-alt text-base font-semibold tracking-tight md:text-lg">
                  {t("stats.teamSizeValue")}
                </dd>
              </div>
              <div className="py-[18px] pl-[18px]">
                <dt className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  {t("stats.track")}
                </dt>
                <dd className="font-display-alt text-base font-semibold tracking-tight md:text-lg">
                  {t("stats.trackValue")}
                </dd>
              </div>
            </dl>
          </div>

          <div className="relative min-h-[460px]">
            <div className="relative aspect-[4/5] max-h-[580px] w-full overflow-hidden border border-ink bg-bg-2">
              <Image
                src="/images/hero.jpg"
                alt={t("imageAlt")}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
                priority
              />
              <div
                aria-hidden
                className="absolute inset-0 -z-10 -m-3 -skew-x-6 bg-accent/10"
              />
            </div>
            <div className="mt-4">
              <ScarcityPanel
                remaining={remaining}
                total={total}
                teamsFormed={teamsFormed}
              />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
