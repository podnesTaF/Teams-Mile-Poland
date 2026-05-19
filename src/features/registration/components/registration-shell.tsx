import { useTranslations } from "next-intl";

import { Container } from "@/components/ui/container";
import { ScarcityPanel } from "@/components/marketing/scarcity-panel";
import { Link } from "@/i18n/navigation";
import { EVENT } from "@/lib/marketing/event";
import type { RegistrationCounters, TeamPreview } from "@/features/registration/data";

type RegistrationShellProps = {
  title: string;
  eyebrow?: string;
  intro: string;
  counters: RegistrationCounters;
  raceBlock: string;
  raceNote: string;
  team?: TeamPreview;
  children: React.ReactNode;
};

export function RegistrationShell({
  title,
  eyebrow = "Registration",
  intro,
  counters,
  raceBlock,
  raceNote,
  team,
  children,
}: RegistrationShellProps) {
  const t = useTranslations("registration.shell");
  const common = useTranslations("common");

  return (
    <main className="bg-bg-2 py-8 md:py-12">
      <Container>
        <Link
          href="/#register"
          className="mb-5 inline-flex font-mono text-[11px] uppercase tracking-[0.12em] text-muted hover:text-accent"
        >
          {common("backToPaths")}
        </Link>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <section className="border border-ink bg-bg">
            <div className="border-b border-ink p-5 md:p-7">
              <span className="eyebrow eyebrow-red">
                {eyebrow === "Registration" ? t("eyebrow") : eyebrow}
              </span>
              <h1 className="shout shout-md mt-3">{title}</h1>
              <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted md:text-base">
                {intro}
              </p>
            </div>
            {children}
          </section>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
            {team ? <TeamPreviewCard team={team} /> : null}
            <ScarcityPanel
              remaining={counters.freeSlotsRemaining}
              total={counters.freeSlotsTotal}
              teamsFormed={counters.teamsFormed}
            />
            <div className="border border-line bg-bg p-5">
              <h2 className="font-display-alt text-sm font-semibold uppercase tracking-[0.08em]">
                {t("raceDay")}
              </h2>
              <dl className="mt-4 flex flex-col gap-3 text-sm">
                <div className="flex justify-between gap-5">
                  <dt className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
                    {t("date")}
                  </dt>
                  <dd>{EVENT.dateLabel.en}</dd>
                </div>
                <div className="flex justify-between gap-5">
                  <dt className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
                    {t("venue")}
                  </dt>
                  <dd className="text-right">{EVENT.venue.name}</dd>
                </div>
                <div className="flex justify-between gap-5">
                  <dt className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
                    {t("block")}
                  </dt>
                  <dd className="text-right">{raceBlock}</dd>
                </div>
              </dl>
              <p className="mt-4 text-xs leading-relaxed text-muted">{raceNote}</p>
            </div>
          </aside>
        </div>
      </Container>
    </main>
  );
}

function TeamPreviewCard({ team }: { team: TeamPreview }) {
  const t = useTranslations("registration.shell");

  return (
    <div className="border border-ink bg-ink p-5 text-white">
      <div className="eyebrow text-white/55">{t("joining")}</div>
      <h2 className="mt-3 font-display text-3xl font-black italic uppercase leading-none">
        {team.name}
      </h2>
      <dl className="mt-5 flex flex-col gap-3 text-sm">
        <div className="flex justify-between gap-5">
          <dt className="font-mono text-[11px] uppercase tracking-[0.1em] text-white/50">
            {t("captain")}
          </dt>
          <dd>{team.captainName ?? t("captainPending")}</dd>
        </div>
        <div className="flex justify-between gap-5">
          <dt className="font-mono text-[11px] uppercase tracking-[0.1em] text-white/50">
            {t("category")}
          </dt>
          <dd className="capitalize">{team.category}</dd>
        </div>
        <div className="flex justify-between gap-5">
          <dt className="font-mono text-[11px] uppercase tracking-[0.1em] text-white/50">
            {t("runners")}
          </dt>
          <dd>
            {team.runnerCount}/{team.capacity}
          </dd>
        </div>
      </dl>
    </div>
  );
}
