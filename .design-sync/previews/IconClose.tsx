import { IconClose, Section } from "teams-mile-warshaw";

/* IconClose is a bare inline SVG: no width/height attributes, no intrinsic
 * cap. Unconstrained it grows to fill its box, so every cell below pins the
 * size with height/width utilities and lets colour arrive via currentColor. */

export function Sizes() {
  return (
    <div className="flex items-end gap-8 p-6 text-ink">
      <div className="flex flex-col items-center gap-2">
        <IconClose className="h-4 w-4" />
        <span className="font-mono text-xs text-muted">h-4 w-4</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <IconClose className="h-5 w-5" />
        <span className="font-mono text-xs text-muted">h-5 w-5</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <IconClose className="h-6 w-6" />
        <span className="font-mono text-xs text-muted">h-6 w-6</span>
      </div>
    </div>
  );
}

/* The real Section supplies text-white on the dark band, which is what the
 * icon inherits — a bare bg-ink div would paint it black on black. */
export function OnSurfaces() {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-4 bg-bg p-6 text-ink">
        <IconClose className="h-5 w-5" />
        <span className="font-mono text-xs uppercase text-muted">Ink on white</span>
      </div>
      <div className="flex items-center gap-4 bg-bg-2 p-6 text-accent">
        <IconClose className="h-5 w-5" />
        <span className="font-mono text-xs uppercase text-muted">Accent on muted</span>
      </div>
      <Section tone="dark" size="sm">
        <div className="flex items-center gap-4">
          <IconClose className="h-5 w-5" />
          <span className="font-mono text-xs uppercase text-white">White on dark</span>
        </div>
      </Section>
    </div>
  );
}

/* Where it actually appears: the dismiss control on dialog chrome
 * (`.modal-close` in modal.tsx renders <IconClose /> inside a bare button). */
export function DialogDismiss() {
  return (
    <div className="p-6">
      <div className="flex w-full max-w-sm items-start justify-between gap-6 border border-line bg-bg p-6">
        <div className="flex flex-col gap-2">
          <p className="font-mono text-xs uppercase text-muted">Step 2 of 3</p>
          <p className="font-bold text-ink">Who is running?</p>
        </div>
        <button
          type="button"
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center border border-line bg-bg text-ink"
        >
          <IconClose className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
