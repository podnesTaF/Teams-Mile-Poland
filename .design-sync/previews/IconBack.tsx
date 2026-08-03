import { IconBack, Section } from "teams-mile-warshaw";

/* IconBack is a bare inline SVG with no intrinsic size cap, so each cell
 * pins the size with height/width utilities; colour comes from currentColor. */

export function Sizes() {
  return (
    <div className="flex items-end gap-8 p-6 text-ink">
      <div className="flex flex-col items-center gap-2">
        <IconBack className="h-4 w-4" />
        <span className="font-mono text-xs text-muted">h-4 w-4</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <IconBack className="h-5 w-5" />
        <span className="font-mono text-xs text-muted">h-5 w-5</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <IconBack className="h-6 w-6" />
        <span className="font-mono text-xs text-muted">h-6 w-6</span>
      </div>
    </div>
  );
}

/* Section tone="dark" is used rather than a bare bg-ink div because it
 * supplies text-white — the colour the chevron inherits. */
export function OnSurfaces() {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-4 bg-bg p-6 text-ink">
        <IconBack className="h-5 w-5" />
        <span className="font-mono text-xs uppercase text-muted">Ink on white</span>
      </div>
      <div className="flex items-center gap-4 bg-bg-2 p-6 text-accent">
        <IconBack className="h-5 w-5" />
        <span className="font-mono text-xs uppercase text-muted">Accent on muted</span>
      </div>
      <Section tone="dark" size="sm">
        <div className="flex items-center gap-4">
          <IconBack className="h-5 w-5" />
          <span className="font-mono text-xs uppercase text-white">White on dark</span>
        </div>
      </Section>
    </div>
  );
}

/* Where it actually appears: `.modal-back` in modal.tsx puts <IconBack />
 * in a small square button at the top-left of a multi-step dialog. */
export function DialogBackStep() {
  return (
    <div className="p-6">
      <div className="flex w-full max-w-sm flex-col gap-4 border border-line bg-bg p-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center border border-line bg-bg text-ink"
          >
            <IconBack className="h-4 w-4" />
          </button>
          <span className="font-mono text-xs uppercase text-muted">Back to team details</span>
        </div>
        <p className="font-bold text-ink">Confirm your entry</p>
        <p className="text-muted">One team, four runners.</p>
      </div>
    </div>
  );
}
