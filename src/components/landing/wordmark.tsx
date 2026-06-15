import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * ACE BATTLE wordmark. Sizing lives in landing.css (`.logo-wm--{nav,foot,mark}`)
 * so the format-stage watermark override can win without inline-style conflicts.
 *
 *  - "nav"    — hero top-nav, uses the ACE BATTLE POLAND lockup
 *  - "header" — fixed landing header on white, ACE BATTLE dark lockup
 *  - "foot"   — large footer mark, uses the ACE BATTLE POLAND lockup
 *  - "mark"   — translucent watermark behind the athlete on the format-band
 */
type WordmarkProps = {
  variant?: "nav" | "header" | "foot" | "mark";
  className?: string;
};

// Per-variant artwork + its real source dimensions (Image needs the intrinsic
// ratio; CSS then scales by height/width). nav + foot show the Poland lockup;
// the format-band watermark keeps the plain ACE BATTLE mark.
const ART = {
  nav: { src: "/brand/ace-battle-poland.svg", w: 451, h: 61, alt: "ACE BATTLE POLAND" },
  header: { src: "/brand/ace-battle-dark.svg", w: 630, h: 70, alt: "ACE BATTLE" },
  foot: { src: "/brand/ace-battle-poland.svg", w: 451, h: 61, alt: "ACE BATTLE POLAND" },
  mark: { src: "/brand/ace-battle.svg", w: 630, h: 70, alt: "ACE BATTLE" },
} as const;

export function Wordmark({ variant = "nav", className }: WordmarkProps) {
  const art = ART[variant];
  return (
    <span
      className={cn(
        "logo-wm",
        variant === "nav" && "logo-wm--nav",
        variant === "header" && "logo-wm--header",
        variant === "foot" && "logo-wm--foot",
        variant === "mark" && "logo-wm--mark",
        className,
      )}
    >
      <Image
        src={art.src}
        alt={art.alt}
        width={art.w}
        height={art.h}
        priority={variant === "nav" || variant === "header"}
      />
    </span>
  );
}
