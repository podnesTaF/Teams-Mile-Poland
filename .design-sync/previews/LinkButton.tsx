import { LinkButton, Section } from "teams-mile-warshaw";

export function Intents() {
  return (
    <div className="flex flex-wrap items-center gap-3 p-6">
      <LinkButton href="/events/warsaw-2026" intent="primary">
        Event details
      </LinkButton>
      <LinkButton href="/events/warsaw-2026/heats" intent="dark">
        Start list
      </LinkButton>
      <LinkButton href="/events/warsaw-2026/results" intent="ghost">
        Results
      </LinkButton>
      <LinkButton href="/rules" intent="link">
        Read the full rules
      </LinkButton>
    </div>
  );
}

export function Sizes() {
  return (
    <div className="flex flex-wrap items-center gap-3 p-6">
      <LinkButton href="/events/warsaw-2026" intent="primary" size="sm">
        Buy a ticket
      </LinkButton>
      <LinkButton href="/events/warsaw-2026" intent="primary" size="md">
        Buy a ticket
      </LinkButton>
      <LinkButton href="/events/warsaw-2026" intent="primary" size="lg">
        Buy a ticket
      </LinkButton>
    </div>
  );
}

/* Wrapped in the real Section rather than a bare dark div so the band supplies
 * text-white for the ghostLight border and label. */
export function OnDarkSurface() {
  return (
    <Section tone="dark" size="sm">
      <div className="flex flex-wrap items-center gap-3">
        <LinkButton href="/register" intent="primary" size="lg">
          Register your team
        </LinkButton>
        <LinkButton href="/prize-fund" intent="ghostLight" size="lg">
          €20,000 prize fund
        </LinkButton>
      </div>
    </Section>
  );
}

export function BlockInACard() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3 border border-line bg-bg-2 p-6">
      <p className="font-mono text-xs uppercase text-muted">
        Warsaw · 22 August 2026
      </p>
      <LinkButton href="/register" intent="primary" block>
        Register your team
      </LinkButton>
      <LinkButton href="/events/warsaw-2026/heats" intent="ghost" block>
        View the heats
      </LinkButton>
    </div>
  );
}
