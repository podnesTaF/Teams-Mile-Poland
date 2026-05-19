import { YouTubeEmbed } from "./youtube-embed";

type ComparisonItem = { k: string; v: string };

const NORMAL: ComparisonItem[] = [
  { k: "Runners", v: "1 runner" },
  { k: "Distance", v: "1 mile" },
  { k: "Tactics", v: "Pacing" },
  { k: "Result", v: "Finish time" },
];

const TEAMS: ComparisonItem[] = [
  {
    k: "Runners",
    v: "7 runners",
  },
  {
    k: "Distance",
    v: "Role-based mile",
  },
  { k: "Tactics", v: "Joker Zone hand-off" },
  { k: "Result", v: "Team time + rankings" },
];

type NormalVsTeamsProps = {
  normalVideoId?: string;
  teamsVideoId?: string;
};

export function NormalVsTeams({
  normalVideoId,
  teamsVideoId,
}: NormalVsTeamsProps) {
  return (
    <div className="grid grid-cols-1 border border-ink md:grid-cols-2">
      <ComparisonCard
        tag="Normal mile"
        title={
          <>
            One runner.
            <br />
            One mile.
          </>
        }
        videoId={normalVideoId}
        items={NORMAL}
      />
      <ComparisonCard
        tag="TEAMS MILE"
        title={
          <>
            Seven athletes.
            <br />
            One mile each.
          </>
        }
        videoId={teamsVideoId}
        items={TEAMS}
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
  dark = false,
}: {
  tag: string;
  title: React.ReactNode;
  videoId?: string;
  items: ComparisonItem[];
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
              {k}
            </span>
            <span>{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
