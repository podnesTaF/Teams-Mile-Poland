import { Eyebrow, Wordmark } from "teams-mile-warshaw";

export function Default() {
  return (
    <div className="p-6">
      <Wordmark />
    </div>
  );
}

export function Sizes() {
  return (
    <div className="flex flex-col items-start gap-5 p-6">
      <Wordmark size={16} />
      <Wordmark size={20} />
      <Wordmark size={28} />
      <Wordmark size={44} />
    </div>
  );
}

export function InAHeaderBar() {
  return (
    <div className="flex w-full max-w-md items-center justify-between gap-6 border border-line bg-bg-2 px-5 py-4">
      <Wordmark size={22} />
      <Eyebrow tone="muted">Warsaw · 22 Aug 2026</Eyebrow>
    </div>
  );
}

/* `light` is the ink-surface variant. A plain bg-ink div is enough here
 * because Wordmark sets its own text-white when light is passed. */
export function LightOnInk() {
  return (
    <div className="flex flex-col items-start gap-5 bg-ink p-6">
      <Wordmark size={28} light />
      <Wordmark size={44} light />
    </div>
  );
}
