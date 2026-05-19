import Link from "next/link";

import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";

export function CtaBanner() {
  return (
    <section className="bg-accent py-24 text-white">
      <Container className="text-center">
        <Eyebrow tone="light">Ready when you are</Eyebrow>
        <div className="my-5 shout shout-lg text-white">
          27 June 2026.
          <br />
          Stadion Podskarbińska.
          <br />
          <span className="text-ink">Be on the line.</span>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-2.5">
          <Link
            href="/register"
            className="inline-flex h-14 items-center justify-center gap-2 bg-ink px-7 font-display-alt text-[15px] font-semibold uppercase tracking-[0.06em] text-white transition-colors hover:bg-ink-2"
          >
            Start your registration
            <span aria-hidden>→</span>
          </Link>
        </div>
      </Container>
    </section>
  );
}
