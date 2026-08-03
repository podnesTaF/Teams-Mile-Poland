import { Chip } from "teams-mile-warshaw";

export function Intents() {
  return (
    <div className="flex flex-wrap items-center gap-2 p-6">
      <Chip intent="default">Heat 2</Chip>
      <Chip intent="outline">Mixed</Chip>
      <Chip intent="red">3 slots left</Chip>
      <Chip intent="dark">Final</Chip>
      <Chip intent="amber">Payment due</Chip>
      <Chip intent="green">Confirmed</Chip>
    </div>
  );
}

export function MonoForNumbers() {
  return (
    <div className="flex flex-wrap items-center gap-2 p-6">
      <Chip mono>04:12.8</Chip>
      <Chip mono intent="outline">
        BIB 148
      </Chip>
      <Chip mono intent="dark">
        16:51.4
      </Chip>
      <Chip mono intent="red">
        DNF
      </Chip>
    </div>
  );
}

/* Chips are a fixed 28px tall and must not wrap, so the labels stay to one
 * word and the rows get whitespace-nowrap. */
export function InAStartListRow() {
  return (
    <div className="flex w-full max-w-lg flex-col gap-3 p-6">
      <div className="flex items-center justify-between gap-4 whitespace-nowrap border border-line bg-bg-2 px-4 py-3">
        <span className="font-semibold uppercase text-ink">Kraków Pacers</span>
        <div className="flex items-center gap-2">
          <Chip intent="green">Confirmed</Chip>
          <Chip mono>04:08.2</Chip>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 whitespace-nowrap border border-line bg-bg-2 px-4 py-3">
        <span className="font-semibold uppercase text-ink">Wisła TC</span>
        <div className="flex items-center gap-2">
          <Chip intent="amber">Unpaid</Chip>
          <Chip mono>04:21.9</Chip>
        </div>
      </div>
    </div>
  );
}
