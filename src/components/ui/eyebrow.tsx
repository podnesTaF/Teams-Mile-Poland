import { cn } from "@/lib/utils";

type EyebrowProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "muted" | "ink" | "red" | "light";
};

const toneClass = {
  muted: "text-muted",
  ink: "text-ink",
  red: "text-accent",
  light: "text-white/60",
} as const;

export function Eyebrow({
  tone = "muted",
  className,
  ...props
}: EyebrowProps) {
  return (
    <span
      className={cn(
        "font-mono text-[11px] font-medium uppercase tracking-[0.14em]",
        toneClass[tone],
        className,
      )}
      {...props}
    />
  );
}
