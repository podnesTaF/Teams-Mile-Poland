import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * ACE BATTLE wordmark — renders the shipped `/brand/ace-battle.svg`.
 * All sizing lives in landing.css (`.logo-wm--{nav,foot,mark}`) so the
 * format-stage watermark override can win without inline-style conflicts.
 *
 *  - "nav"  — hero top-nav
 *  - "foot" — large footer mark
 *  - "mark" — translucent watermark behind the athlete on the format-band
 */
type WordmarkProps = {
  variant?: "nav" | "foot" | "mark";
  className?: string;
};

// Real source dimensions of /brand/ace-battle.svg.
const SRC_W = 630;
const SRC_H = 70;

export function Wordmark({ variant = "nav", className }: WordmarkProps) {
  return (
    <span
      className={cn(
        "logo-wm",
        variant === "nav" && "logo-wm--nav",
        variant === "foot" && "logo-wm--foot",
        variant === "mark" && "logo-wm--mark",
        className,
      )}
    >
      <Image
        src="/brand/ace-battle.svg"
        alt="ACE BATTLE"
        width={SRC_W}
        height={SRC_H}
        priority={variant === "nav"}
      />
    </span>
  );
}
