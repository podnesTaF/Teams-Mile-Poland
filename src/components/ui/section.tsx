import { cn } from "@/lib/utils";

import { Container } from "./container";
import { Eyebrow } from "./eyebrow";

type SectionProps = React.HTMLAttributes<HTMLElement> & {
  tone?: "default" | "muted" | "dark" | "red";
  size?: "default" | "sm";
};

const toneClass = {
  default: "bg-bg text-ink",
  muted: "bg-bg-2 text-ink",
  dark: "bg-ink text-white",
  red: "bg-accent text-white",
} as const;

export function Section({
  tone = "default",
  size = "default",
  className,
  children,
  ...props
}: SectionProps) {
  return (
    <section
      className={cn(
        toneClass[tone],
        size === "sm" ? "py-14" : "py-24 md:py-24",
        className,
      )}
      {...props}
    >
      <Container>{children}</Container>
    </section>
  );
}

type SectionHeadProps = {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  tone?: "default" | "light";
  className?: string;
  align?: "start" | "center";
};

export function SectionHead({
  eyebrow,
  title,
  description,
  tone = "default",
  align = "start",
  className,
}: SectionHeadProps) {
  return (
    <header
      className={cn(
        "mb-12 max-w-[760px]",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      {eyebrow ? (
        <Eyebrow
          tone={tone === "light" ? "light" : "muted"}
          className="block mb-4"
        >
          {eyebrow}
        </Eyebrow>
      ) : null}
      <h2 className="shout shout-md mt-3.5">{title}</h2>
      {description ? (
        <p
          className={cn(
            "mt-4 max-w-[60ch] text-[17px]",
            tone === "light" ? "text-white/75" : "text-muted",
          )}
        >
          {description}
        </p>
      ) : null}
    </header>
  );
}
