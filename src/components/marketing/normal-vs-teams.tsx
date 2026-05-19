import { useTranslations } from "next-intl";

import { YouTubeEmbed } from "./youtube-embed";

type ComparisonItem = { k: string; v: string };
type Translation = ReturnType<typeof useTranslations>;

const NORMAL: ComparisonItem[] = [
  { k: "runners", v: "normalRunners" },
  { k: "distance", v: "normalDistance" },
  { k: "tactics", v: "normalTactics" },
  { k: "result", v: "normalResult" },
];

const TEAMS: ComparisonItem[] = [
  {
    k: "runners",
    v: "teamsRunners",
  },
  {
    k: "distance",
    v: "teamsDistance",
  },
  { k: "tactics", v: "teamsTactics" },
  { k: "result", v: "teamsResult" },
];

type NormalVsTeamsProps = {
  normalVideoId?: string;
  teamsVideoId?: string;
};

export function NormalVsTeams({
  normalVideoId,
  teamsVideoId,
}: NormalVsTeamsProps) {
  const t = useTranslations("comparison");

  return (
    <div className="grid grid-cols-1 border border-ink md:grid-cols-2">
      <ComparisonCard
        tag={t("normalTag")}
        title={
          <>
            {t("normalTitleA")}
            <br />
            {t("normalTitleB")}
          </>
        }
        videoId={normalVideoId}
        items={NORMAL}
        t={t}
      />
      <ComparisonCard
        tag={t("teamsTag")}
        title={
          <>
            {t("teamsTitleA")}
            <br />
            {t("teamsTitleB")}
          </>
        }
        videoId={teamsVideoId}
        items={TEAMS}
        t={t}
        dark
      />
    </div>
  );
}

function ComparisonCard({
  tag,
  title,
  videoId,
  items,
  t,
  dark = false,
}: {
  tag: string;
  title: React.ReactNode;
  videoId?: string;
  items: ComparisonItem[];
  t: Translation;
  dark?: boolean;
}) {
  return (
    <div
      className={
        dark
          ? "relative overflow-hidden bg-ink p-9 text-white"
          : "relative overflow-hidden border-b border-ink bg-bg p-9 md:border-b-0 md:border-r"
      }
    >
      <span
        className={
          dark
            ? "mb-5 inline-flex items-center gap-2 bg-accent px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white"
            : "mb-5 inline-flex items-center gap-2 bg-bg-2 px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-ink"
        }
      >
        {tag}
      </span>
      <h3 className="mb-6 font-display text-[clamp(28px,3vw,40px)] font-black italic uppercase leading-[0.9] tracking-tight">
        {title}
      </h3>
      <YouTubeEmbed videoId={videoId} title={tag} />
      <ul className="m-0 list-none p-0">
        {items.map(({ k, v }) => (
          <li
            key={k}
            className={
              dark
                ? "grid grid-cols-[100px_1fr] items-baseline gap-3 border-b border-white/10 py-3.5 text-sm last:border-b-0"
                : "grid grid-cols-[100px_1fr] items-baseline gap-3 border-b border-line py-3.5 text-sm last:border-b-0"
            }
          >
            <span
              className={
                dark
                  ? "font-mono text-[10px] uppercase tracking-[0.08em] text-white/55"
                  : "font-mono text-[10px] uppercase tracking-[0.08em] text-muted"
              }
            >
              {t(`rows.${k}`)}
            </span>
            <span>{t(`rows.${v}`)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
