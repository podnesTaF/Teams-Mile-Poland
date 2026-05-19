import { Container } from "@/components/ui/container";
import { Chip } from "@/components/ui/chip";
import { Wordmark } from "@/components/ui/wordmark";
import { EVENT } from "@/lib/marketing/event";

const SECTIONS = [
  {
    heading: "Event",
    links: [
      { label: "The sport", href: "#sport" },
      { label: "Schedule", href: "#schedule" },
      { label: "Venue", href: "#venue" },
      { label: "Documents", href: "#documents" },
    ],
  },
  {
    heading: "Register",
    links: [
      { label: "Start a team", href: "/register/start" },
      { label: "Join a team", href: "/join" },
      { label: "Find me a team", href: "/register/free" },
      { label: "Run solo", href: "/register/solo" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Rules & regulations", href: "/rules" },
      { label: "Refund policy", href: "/rules#refunds" },
      { label: "Privacy", href: "/rules#privacy" },
      { label: "Contact", href: "mailto:warsaw@acebattle.run" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-ink pb-8 pt-[72px] text-white">
      <Container>
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <Wordmark light size={24} className="mb-[18px]" />
            <p className="mb-[22px] max-w-[32ch] text-sm leading-relaxed text-white/65">
              Polish launch event of ACE BATTLE MILE.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Chip intent="red">{EVENT.shortDate}</Chip>
              <Chip className="border-white/15 bg-white/10 text-white">
                {EVENT.venue.city} · PL
              </Chip>
            </div>
          </div>

          {SECTIONS.map((section) => (
            <div key={section.heading}>
              <h5 className="mb-4 font-display-alt text-[11px] font-medium uppercase tracking-[0.14em] text-white/60">
                {section.heading}
              </h5>
              <ul className="flex flex-col gap-2.5 text-sm">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-white/70 transition-colors hover:text-accent"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          aria-hidden
          className="mt-12 select-none text-center font-display text-[18vw] font-black italic uppercase leading-[0.85] tracking-[-0.04em] text-white/[0.04]"
        >
          TEAMS·MILE
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-7 font-mono text-[11px] uppercase tracking-[0.08em] text-white/60">
          <div>
            © 2026 ACE BATTLE POLAND Ltd · Licensed event under ACE BATTLE
            ASSOCIATION · Luxembourg
          </div>
          <div>v1.0 · Warsaw edition</div>
        </div>
      </Container>
    </footer>
  );
}
