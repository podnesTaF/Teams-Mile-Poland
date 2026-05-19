import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-display-alt font-semibold uppercase tracking-[0.06em] transition-colors duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      intent: {
        primary: "bg-accent text-white hover:bg-[#b8302a]",
        dark: "bg-ink text-white hover:bg-ink-2",
        ghost:
          "border border-ink bg-transparent text-ink hover:bg-ink hover:text-bg",
        ghostLight:
          "border border-white/40 bg-transparent text-white hover:border-white hover:bg-white hover:text-ink",
        link:
          "h-auto border-b border-current p-0 text-sm font-medium uppercase tracking-normal text-ink",
      },
      size: {
        sm: "h-9 px-3.5 text-[11.5px] tracking-[0.08em]",
        md: "h-12 px-[22px] text-sm",
        lg: "h-14 px-7 text-[15px]",
      },
      block: {
        true: "w-full",
      },
    },
    compoundVariants: [
      { intent: "link", size: ["sm", "md", "lg"], className: "h-auto px-0" },
    ],
    defaultVariants: {
      intent: "primary",
      size: "md",
    },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonStyles> & {
    asChild?: false;
  };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, intent, size, block, ...props }, ref) {
    return (
      <button
        ref={ref}
        className={cn(buttonStyles({ intent, size, block }), className)}
        {...props}
      />
    );
  },
);

type LinkButtonProps = React.AnchorHTMLAttributes<HTMLAnchorElement> &
  VariantProps<typeof buttonStyles>;

export function LinkButton({
  className,
  intent,
  size,
  block,
  ...props
}: LinkButtonProps) {
  return (
    <a
      className={cn(buttonStyles({ intent, size, block }), className)}
      {...props}
    />
  );
}

export { buttonStyles };
