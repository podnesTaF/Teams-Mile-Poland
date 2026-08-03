import { Button, Chip, Eyebrow, Rank, Section, SectionHead } from "teams-mile-warshaw";

/* Canonical band: tone="muted" for an alternating surface, a SectionHead and
 * a card grid — the shape most pages are built from. Note there is no
 * Container here: Section already wraps its children in one. */
export function MutedBand() {
  return (
    <Section tone="muted">
      <SectionHead
        eyebrow="The format"
        title="How the race works"
        description="Three heats seeded on your entry time, then a final for the eight fastest teams."
      />
      <div className="grid gap-6 md:grid-cols-3">
        <div className="bg-bg p-6">
          <Eyebrow tone="red" className="block mb-3">
            Step 01
          </Eyebrow>
          <h3 className="font-display text-xl text-ink">Enter as four</h3>
          <p className="mt-2 text-muted">
            One captain registers the team and names all four runners.
          </p>
        </div>
        <div className="bg-bg p-6">
          <Eyebrow tone="red" className="block mb-3">
            Step 02
          </Eyebrow>
          <h3 className="font-display text-xl text-ink">Race your heat</h3>
          <p className="mt-2 text-muted">
            Heats go off at 18:00, 18:40 and 19:20 on the riverside loop.
          </p>
        </div>
        <div className="bg-bg p-6">
          <Eyebrow tone="red" className="block mb-3">
            Step 03
          </Eyebrow>
          <h3 className="font-display text-xl text-ink">Take the final</h3>
          <p className="mt-2 text-muted">
            The eight fastest teams line up again at 21:00 under the lights.
          </p>
        </div>
      </div>
    </Section>
  );
}

/* tone="dark" — supplies its own text-white, so nested components switch to
 * their light variants (Eyebrow tone="light", Button intent="ghostLight"). */
export function DarkBand() {
  return (
    <Section tone="dark">
      <SectionHead
        tone="light"
        eyebrow="Prize fund"
        title="€20,000 across four podiums"
        description="Paid out on the night, on the finish-line stage, in front of the crowd."
      />
      <div className="flex flex-wrap items-center gap-4">
        <Button intent="primary">Register a team</Button>
        <Button intent="ghostLight">Read the regulations</Button>
      </div>
    </Section>
  );
}

/* tone="red" — the accent band, reserved for one call to action per page. */
export function RedBand() {
  return (
    <Section tone="red">
      <SectionHead
        tone="light"
        align="center"
        eyebrow="Entries close 31 July"
        title="Bring three friends to Warsaw"
        description="120 team places, and last year every one of them went in under a fortnight."
      />
      <div className="flex justify-center">
        <Button intent="dark">Claim your slot</Button>
      </div>
    </Section>
  );
}

/* size="sm" on the default surface — the tighter rhythm used for narrow
 * bands like a results strip between two full-size sections. */
export function SmallDefaultBand() {
  return (
    <Section size="sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Eyebrow className="block mb-2">Final · 21:00</Eyebrow>
          <h3 className="font-display text-2xl text-ink">
            Praga Track Club take it in 4:21.6
          </h3>
        </div>
        <Chip intent="green" mono>
          Provisional
        </Chip>
      </div>
      <div className="mt-6 flex flex-col gap-3">
        <div className="flex items-center gap-4 border-t border-line pt-3">
          <Rank rank="1" />
          <span className="flex-1 text-ink">Praga Track Club</span>
          <span className="font-mono text-muted">4:21.6</span>
        </div>
        <div className="flex items-center gap-4 border-t border-line pt-3">
          <Rank rank="2" intent="outline" />
          <span className="flex-1 text-ink">Mokotów Milers</span>
          <span className="font-mono text-muted">4:24.9</span>
        </div>
        <div className="flex items-center gap-4 border-t border-line pt-3">
          <Rank rank="3" intent="outline" />
          <span className="flex-1 text-ink">Wisła Pace Project</span>
          <span className="font-mono text-muted">4:28.3</span>
        </div>
      </div>
    </Section>
  );
}
