import { Container } from "@/components/ui/container";
import { Link } from "@/i18n/navigation";
import { EVENT } from "@/lib/marketing/event";

import { SlotBadge } from "./slot-badge";
import Image from "next/image";

const NAV_LINKS = [
  { href: "#sport", label: "The Sport" },
  { href: "#schedule", label: "Schedule" },
  { href: "#venue", label: "Venue" },
  { href: "#documents", label: "Documents" },
  { href: "#faq", label: "FAQ" },
];

type HeaderProps = {
  remaining?: number;
  total?: number;
};

export function Header({
  remaining = EVENT.freeTier.total,
  total = EVENT.freeTier.total,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg">
      <Container className="flex h-[68px] items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/brand/logo.svg" alt="TEAMS MILE" className="w-auto h-6 lg:h-10" width={22} height={150} />
          <span className="hidden border-l border-line pl-3 font-mono text-[10px] uppercase leading-tight tracking-[0.14em] text-muted sm:inline-block">
            Warsaw
            <br />
            {EVENT.dateLabel.en}
          </span>
        </Link>

        <nav className="hidden gap-6 lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="font-display-alt text-[13px] font-medium uppercase tracking-[0.08em] text-ink transition-colors hover:text-accent"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <SlotBadge remaining={remaining} total={total} />
          <Link
            href="/register"
            className="inline-flex h-9 items-center justify-center gap-2 bg-accent px-3.5 font-display-alt text-[11.5px] font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#b8302a] active:translate-y-px"
          >
            Register
          </Link>
        </div>
      </Container>
    </header>
  );
}
