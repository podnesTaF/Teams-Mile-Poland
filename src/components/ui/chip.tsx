import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const chipStyles = cva(
  "inline-flex h-7 items-center gap-1.5 rounded-pill border px-3 font-display-alt text-[11px] font-medium uppercase tracking-[0.1em]",
  {
    variants: {
      intent: {
        default: "border-line bg-bg-2 text-ink",
        outline: "border-line bg-transparent text-ink",
        red: "border-accent bg-accent text-white",
        dark: "border-ink bg-ink text-white",
        amber: "border-transparent bg-[#fcecd1] text-warning",
        green: "border-transparent bg-[#d9ebe0] text-success",
      },
      mono: {
        true: "font-mono",
      },
    },
    defaultVariants: {
      intent: "default",
    },
  },
);

type ChipProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof chipStyles>;

export function Chip({ className, intent, mono, ...props }: ChipProps) {
  return (
    <span className={cn(chipStyles({ intent, mono }), className)} {...props} />
  );
}
