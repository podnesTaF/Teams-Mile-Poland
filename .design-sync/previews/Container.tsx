import { Button, Chip, Container, Eyebrow, Wordmark } from "teams-mile-warshaw";

/* Canonical use: the site header landmark. `as="header"` swaps the element,
 * the className adds the row layout on top of the 1280px measure + gutter. */
export function AsHeader() {
  return (
    <Container
      as="header"
      className="flex items-center justify-between border-b border-line py-4"
    >
      <Wordmark size={22} />
      <nav className="flex items-center gap-6">
        <Eyebrow tone="ink">Format</Eyebrow>
        <Eyebrow tone="ink">Start list</Eyebrow>
        <Eyebrow tone="ink">Results</Eyebrow>
        <Button intent="primary" size="sm">
          Register a team
        </Button>
      </nav>
    </Container>
  );
}

/* The measure itself: content stops at max-w-container and keeps the 24px
 * gutter, so the band edges line up with every other Container on the page. */
export function ContentMeasure() {
  return (
    <div className="bg-bg-2 py-10">
      <Container>
        <Eyebrow className="block mb-3">Warsaw · 22 August 2026</Eyebrow>
        <h2 className="shout shout-md text-ink">
          Four runners. One mile. One clock.
        </h2>
        <p className="mt-4 max-w-prose text-muted">
          Teams of four run the mile together on the closed loop along
          Wybrzeże Kościuszkowskie. The team time is taken when the fourth
          runner crosses the line, which is why the pacing plan matters more
          than any single split.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Chip intent="red">3 heats</Chip>
          <Chip intent="dark">1 final</Chip>
          <Chip>€20,000 prize fund</Chip>
        </div>
      </Container>
    </div>
  );
}

/* `as="footer"` — the same measure serving the closing landmark, with a grid
 * laid on top to show that layout classes compose with the container. */
export function AsFooter() {
  return (
    <Container
      as="footer"
      className="grid gap-8 border-t border-line py-10 md:grid-cols-3"
    >
      <div className="flex flex-col gap-3">
        <Wordmark size={20} />
        <p className="text-muted">
          Ace Battle Run · Teams Mile Warsaw, August 2026.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Eyebrow className="block">Race</Eyebrow>
        <span className="text-muted">Format &amp; rules</span>
        <span className="text-muted">Heats &amp; start list</span>
        <span className="text-muted">Results archive</span>
      </div>
      <div className="flex flex-col gap-2">
        <Eyebrow className="block">Contact</Eyebrow>
        <span className="text-muted">teams@acebattlerun.com</span>
        <span className="text-muted">Press enquiries</span>
      </div>
    </Container>
  );
}
