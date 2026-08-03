import { IconPerson, Section } from "teams-mile-warshaw";

/* IconPerson is a bare inline SVG with no intrinsic size cap, so each cell
 * pins the size with height/width utilities; colour comes from currentColor. */

export function Sizes() {
  return (
    <div className="flex items-end gap-8 p-6 text-ink">
      <div className="flex flex-col items-center gap-2">
        <IconPerson className="h-4 w-4" />
        <span className="font-mono text-xs text-muted">h-4 w-4</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <IconPerson className="h-5 w-5" />
        <span className="font-mono text-xs text-muted">h-5 w-5</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <IconPerson className="h-6 w-6" />
        <span className="font-mono text-xs text-muted">h-6 w-6</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <IconPerson className="h-8 w-8" />
        <span className="font-mono text-xs text-muted">h-8 w-8</span>
      </div>
    </div>
  );
}

/* Section tone="dark" is used rather than a bare bg-ink div because it
 * supplies text-white — the colour the glyph fill inherits. */
export function OnSurfaces() {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-4 bg-bg p-6 text-ink">
        <IconPerson className="h-6 w-6" />
        <span className="font-mono text-xs uppercase text-muted">Ink on white</span>
      </div>
      <div className="flex items-center gap-4 bg-bg-2 p-6 text-accent">
        <IconPerson className="h-6 w-6" />
        <span className="font-mono text-xs uppercase text-muted">Accent on muted</span>
      </div>
      <Section tone="dark" size="sm">
        <div className="flex items-center gap-4">
          <IconPerson className="h-6 w-6" />
          <span className="font-mono text-xs uppercase text-white">White on dark</span>
        </div>
      </Section>
    </div>
  );
}

/* Where it actually appears: the solo half of the registration chooser, where
 * the icon sits above the label on a `.choose-card` (see chooser-modal.tsx). */
export function SoloEntryPath() {
  return (
    <div className="p-6">
      <div className="flex w-full max-w-sm flex-col gap-3 border border-line bg-bg-2 p-6 text-accent">
        <IconPerson className="h-8 w-8" />
        <p className="font-bold text-ink">Run solo</p>
        <p className="text-muted">
          We place you in a team of four on race morning.
        </p>
      </div>
    </div>
  );
}
