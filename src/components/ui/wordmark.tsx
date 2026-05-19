import { cn } from "@/lib/utils";

type WordmarkProps = {
  light?: boolean;
  className?: string;
  size?: number;
};

export function Wordmark({ light = false, className, size = 20 }: WordmarkProps) {
  return (
    <span
      aria-label="TEAMS MILE"
      className={cn(
        "inline-flex items-center font-display font-black italic uppercase leading-none tracking-tight whitespace-nowrap",
        light ? "text-white" : "text-ink",
        className,
      )}
      style={{ fontSize: size }}
    >
      <span>TEAMS</span>
      <span
        aria-hidden
        className="mx-[0.22em] inline-block h-[1.1em] w-[0.18em] -skew-x-12 bg-accent"
      />
      <span>MILE</span>
    </span>
  );
}
