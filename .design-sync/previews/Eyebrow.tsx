import { Eyebrow, Section } from "teams-mile-warshaw";

export function Tones() {
  return (
    <div className="flex flex-col gap-3 p-6">
      <Eyebrow tone="muted">Warsaw · August 2026</Eyebrow>
      <Eyebrow tone="ink">Heat 2 · Lane 4</Eyebrow>
      <Eyebrow tone="red">Registration closes 1 August</Eyebrow>
    </div>
  );
}

export function AboveAHeading() {
  return (
    <div className="max-w-md p-6">
      <Eyebrow tone="red" className="block mb-4">
        Warsaw · 2026
      </Eyebrow>
      <h2 className="shout shout-md text-ink">Race the mile as a team</h2>
      <p className="mt-4 text-muted">
        Four runners, one clock. The team time is the last runner across the
        line.
      </p>
    </div>
  );
}

export function AsAFieldGroupLabel() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-2 border border-line bg-bg-2 p-6">
      <Eyebrow tone="muted" className="block">
        Team captain
      </Eyebrow>
      <p className="font-semibold uppercase text-ink">Magdalena Nowak</p>
      <p className="font-mono text-xs text-muted">Kraków Pacers · BIB 148</p>
    </div>
  );
}

/* tone="light" only reads on a dark band, and Section tone="dark" is what
 * supplies the surrounding text-white for the heading beside it. */
export function OnDarkSurface() {
  return (
    <Section tone="dark" size="sm">
      <Eyebrow tone="light" className="block mb-4">
        Prize fund
      </Eyebrow>
      <h2 className="shout shout-md">€20,000 across four podiums</h2>
    </Section>
  );
}
