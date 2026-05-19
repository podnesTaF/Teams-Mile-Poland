import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const rankStyles = cva(
  "inline-flex h-9 w-7 items-center justify-center font-display text-base font-black italic uppercase tracking-tight",
  {
    variants: {
      intent: {
        ink: "bg-ink text-white",
        red: "bg-accent text-white",
        outline: "border-2 border-ink bg-transparent text-ink",
        outlineLight: "border-2 border-white/60 bg-transparent text-white",
      },
      size: {
        sm: "h-7 w-6 text-[13px]",
        md: "h-9 w-7 text-base",
        lg: "h-11 w-9 text-lg",
      },
    },
    defaultVariants: {
      intent: "ink",
      size: "md",
    },
  },
);

type RankProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof rankStyles> & {
    rank: string;
  };

export function Rank({ rank, className, intent, size, ...props }: RankProps) {
  return (
    <span
      aria-label={`Rank ${rank}`}
      className={cn(rankStyles({ intent, size }), className)}
      {...props}
    >
      {rank}
    </span>
  );
}
