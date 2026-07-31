import { Rank, Section } from "teams-mile-warshaw";

export function Intents() {
  return (
    <div className="flex flex-wrap items-center gap-3 p-6">
      <Rank rank="1" intent="red" />
      <Rank rank="12" intent="ink" />
      <Rank rank="DNF" intent="outline" />
    </div>
  );
}

export function Sizes() {
  return (
    <div className="flex flex-wrap items-end gap-3 p-6">
      <Rank rank="1" intent="red" size="sm" />
      <Rank rank="1" intent="red" size="md" />
      <Rank rank="1" intent="red" size="lg" />
    </div>
  );
}

export function ResultsColumn() {
  return (
    <div className="flex w-full max-w-md flex-col gap-2 p-6">
      <div className="flex items-center gap-4">
        <Rank rank="1" intent="red" />
        <span className="flex-1 font-semibold uppercase text-ink">
          Kraków Pacers
        </span>
        <span className="font-mono text-sm text-ink">16:33.1</span>
      </div>
      <div className="flex items-center gap-4">
        <Rank rank="2" intent="red" />
        <span className="flex-1 font-semibold uppercase text-ink">
          Wisła Track Club
        </span>
        <span className="font-mono text-sm text-ink">16:51.4</span>
      </div>
      <div className="flex items-center gap-4">
        <Rank rank="11" />
        <span className="flex-1 font-semibold uppercase text-ink">
          Mokotów Milers
        </span>
        <span className="font-mono text-sm text-muted">18:04.7</span>
      </div>
    </div>
  );
}

/* Section tone="dark" supplies text-white for the surrounding row text;
 * outlineLight is the variant meant for that band. */
export function OnDarkSurface() {
  return (
    <Section tone="dark" size="sm">
      <div className="flex flex-wrap items-center gap-3">
        <Rank rank="1" intent="red" size="lg" />
        <Rank rank="2" intent="outlineLight" size="lg" />
        <Rank rank="3" intent="outlineLight" size="lg" />
        <span className="font-mono text-xs uppercase text-white">
          Podium · Warsaw 2026 final
        </span>
      </div>
    </Section>
  );
}
