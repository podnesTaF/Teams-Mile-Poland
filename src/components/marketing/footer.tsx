import { useTranslations } from "next-intl";

import { Container } from "@/components/ui/container";
import { Chip } from "@/components/ui/chip";
import { Wordmark } from "@/components/ui/wordmark";
import { Link } from "@/i18n/navigation";
import { EVENT } from "@/lib/marketing/event";
import Image from "next/image";

const SECTIONS = [
  {
    heading: "event",
    links: [
      { label: "sport", href: "/#sport" },
      { label: "schedule", href: "/#schedule" },
      { label: "venue", href: "/#venue" },
      { label: "documents", href: "/#documents" },
    ],
  },
  {
    heading: "register",
    links: [
      { label: "start", href: "/register/team" },
      { label: "free", href: "/register/solo" },
      { label: "contactUs", href: "/#contact" },
    ],
  },
  {
    heading: "legal",
    links: [
      { label: "rules", href: "/#documents" },
      { label: "refund", href: "/#documents" },
      { label: "privacy", href: "/terms" },
      { label: "contact", href: "mailto:info@poland.acebattle.run" },
    ],
  },
];

const SOCIAL_LINKS = [
  { label: "YouTube", href: "https://www.youtube.com/@acebattlerun/videos" },
  { label: "Instagram", href: "https://www.instagram.com/acebattle_run/" },
] as const;

export function Footer() {
  const t = useTranslations("footer");
  const common = useTranslations("common");

  return (
    <footer className="bg-ink pb-8 pt-[72px] text-white">
      <Container>
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <Wordmark light size={24} className="mb-[18px]" />
            <p className="mb-[22px] max-w-[32ch] text-sm leading-relaxed text-white/65">
              {t("text")}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Chip intent="red">{EVENT.shortDate}</Chip>
              <Chip className="border-white/15 bg-white/10 text-white">
                {EVENT.venue.city} · PL
              </Chip>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {SOCIAL_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-b border-white/25 font-display-alt text-xs font-semibold uppercase tracking-[0.08em] text-white/75 transition-colors hover:border-accent hover:text-accent"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {SECTIONS.map((section) => (
            <div key={section.heading}>
              <h5 className="mb-4 font-display-alt text-[11px] font-medium uppercase tracking-[0.14em] text-white/60">
                {section.heading === "register" ? common("register") : t(section.heading)}
              </h5>
              <ul className="flex flex-col gap-2.5 text-sm">
                {section.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith("mailto:") ? (
                      <a
                        href={link.href}
                        className="text-white/70 transition-colors hover:text-accent"
                      >
                        {t(`links.${link.label}`)}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-white/70 transition-colors hover:text-accent"
                      >
                        {t(`links.${link.label}`)}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          aria-hidden
          className="mt-12 flex select-none items-center justify-center font-display text-[18vw] font-black uppercase italic leading-[0.85] tracking-[-0.04em] text-white/[0.04]"
        >
          <Image
            src="/brand/logo-white.svg"
            alt="TEAMS MILE"
            className="h-30 w-auto lg:h-72"
            width={1300}
            height={220}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-7 font-mono text-[11px] uppercase tracking-[0.08em] text-white/60">
          <div>{t("legalLine")}</div>
          <div>{t("version")}</div>
        </div>
      </Container>
    </footer>
  );
}
