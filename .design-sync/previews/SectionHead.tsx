import { Section, SectionHead } from "teams-mile-warshaw";

export function WithEyebrowAndLead() {
  return (
    <div className="p-6">
      <SectionHead
        eyebrow="Warsaw · August 2026"
        title="Four runners. One mile. One clock."
        description="Teams of four race the mile together, and the finish is the last runner across the line."
      />
    </div>
  );
}

export function Centered() {
  return (
    <div className="p-6">
      <SectionHead
        align="center"
        eyebrow="The format"
        title="How the race works"
        description="Three heats, one final. Every runner counts towards the team time."
      />
    </div>
  );
}

export function TitleOnly() {
  return (
    <div className="p-6">
      <SectionHead title="Results" />
    </div>
  );
}

/* Wrapped in a real Section rather than a bare `bg-ink` div: `.shout` sets no
 * colour of its own, so the title inherits it. Section tone="dark" supplies
 * the `text-white` that makes the heading visible — a bare dark div renders it
 * black-on-black. */
export function OnDarkSurface() {
  return (
    <Section tone="dark" size="sm">
      <SectionHead
        tone="light"
        eyebrow="Prize fund"
        title="€20,000 across four podiums"
        description="Paid out on the night, in front of the crowd."
      />
    </Section>
  );
}
