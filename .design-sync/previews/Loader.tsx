import { Eyebrow, Loader } from "teams-mile-warshaw";

/* Loader is a <picture> pointing at /loading.webp (with /loading.gif as a
 * fallback), both served by the host app from its public root. Those files are
 * deliberately not part of this design system, so the animation cannot paint
 * here and no amount of preview work will change that — what the component
 * renders instead is its own `label`, through the img alt.
 *
 * So each cell frames the component in a tile of the size it would occupy and
 * captions the dependency. The card then documents the real constraint at the
 * real scale, instead of looking like a rendering bug. */

function Tile({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="flex items-center justify-center border border-line bg-bg-3 text-muted"
        style={{ width: size, height: size }}
      >
        {children}
      </div>
      <span className="font-mono text-xs text-muted">{size}px</span>
    </div>
  );
}

function Caption() {
  return (
    <Eyebrow className="block">
      Animation served by the host app · /loading.webp
    </Eyebrow>
  );
}

export function Sizes() {
  return (
    <div className="flex flex-col gap-5 p-6">
      <Caption />
      <div className="flex flex-wrap items-end gap-6">
        <Tile size={48}>
          <Loader size={48} label="" />
        </Tile>
        <Tile size={96}>
          <Loader size={96} label="" />
        </Tile>
        <Tile size={132}>
          <Loader size={132} label="" />
        </Tile>
      </div>
    </div>
  );
}

export function WithAccessibleLabel() {
  return (
    <div className="flex flex-col gap-5 p-6">
      <Caption />
      <div className="flex items-center gap-4">
        <Tile size={72}>
          <Loader size={72} label="" />
        </Tile>
        <p className="text-sm text-muted">
          <code className="font-mono text-xs">label</code> sets the image alt, so
          the wait is announced to assistive tech — pass something specific like
          &ldquo;Loading results&rdquo;.
        </p>
      </div>
    </div>
  );
}
