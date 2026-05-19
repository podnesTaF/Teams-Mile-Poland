import Image from "next/image";

import { Eyebrow } from "@/components/ui/eyebrow";
import { EVENT } from "@/lib/marketing/event";

export function Venue() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[1.1fr_1fr] md:items-center md:gap-12">
      <div className="relative aspect-[4/3] w-full border border-ink bg-bg-2">
        <Image
          src="/brand/track-light.svg"
          alt={`Diagram of ${EVENT.venue.name} track`}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-contain p-8"
        />
      </div>
      <div>
        <Eyebrow>The venue</Eyebrow>
        <h2 className="mb-5 mt-2">{EVENT.venue.name}</h2>
        <p className="m-0 mb-6 max-w-[36ch] text-lg leading-relaxed text-muted">
          400 m outdoor track in Warsaw.
        </p>
        <div className="border border-line bg-bg">
          <div className="border-b border-line p-[18px]">
            <Eyebrow>Address</Eyebrow>
            <div className="mt-1 font-display-alt font-semibold">
              {EVENT.venue.address}
              <br />
              {EVENT.venue.postal} {EVENT.venue.city}, {EVENT.venue.country}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 p-[18px]">
            <div>
              <Eyebrow>Track</Eyebrow>
              <div className="mt-1 font-display-alt font-semibold">
                {EVENT.venue.track.length} · {EVENT.venue.track.lanes} lanes
              </div>
            </div>
            <div>
              <Eyebrow>Surface</Eyebrow>
              <div className="mt-1 font-display-alt font-semibold">
                {EVENT.venue.track.surface}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
