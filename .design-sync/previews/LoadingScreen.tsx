import { Eyebrow, LoadingScreen } from "teams-mile-warshaw";

/* Two constraints stack here.
 *
 * `.loading-screen` is `position: fixed; inset: 0` over a near-black fill, so
 * without a containing block it paints over the whole card and swallows the
 * caption. The stage carries `transform: translateZ(0)` for the same reason
 * Modal.tsx's Stage does — that makes `fixed` resolve against the stage.
 *
 * And the tile inside it comes from /loading.webp, served by the host app, so
 * it cannot paint here. What this card can honestly show is the dark
 * full-bleed surface and the centred placement. */

export function FullScreenWait() {
  return (
    <div className="flex flex-col gap-5 p-6">
      <Eyebrow className="block">
        Route-level fallback · animation served by the host app
      </Eyebrow>
      <div
        className="relative w-full overflow-hidden border border-line"
        style={{ height: 380, transform: "translateZ(0)" }}
      >
        <LoadingScreen />
      </div>
      <p className="text-sm text-muted">
        Covers the viewport in near-black and centres a{" "}
        <code className="font-mono text-xs">Loader</code>, with{" "}
        <code className="font-mono text-xs">role=&quot;status&quot;</code> so the wait is
        announced. Takes no props — use it as a route&rsquo;s loading fallback.
      </p>
    </div>
  );
}
