"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { cn } from "@/lib/utils";

const FAQ_KEYS = ["one", "two", "three", "four", "five", "six", "seven"] as const;

export function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState(0);
  const t = useTranslations("faqItems");

  return (
    <div className="border border-ink bg-bg px-8 py-2">
      <div className="flex flex-col">
        {FAQ_KEYS.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div
              key={item}
              className="border-b border-line last:border-b-0"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? -1 : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 bg-transparent py-7 text-left font-display text-[clamp(18px,1.8vw,22px)] font-black italic uppercase tracking-tight text-ink"
              >
                <span>{t(`${item}.q`)}</span>
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex h-7 w-7 flex-shrink-0 items-center justify-center border border-ink font-display-alt text-base font-bold not-italic transition-all duration-200",
                    isOpen &&
                      "rotate-45 border-accent bg-accent text-white",
                  )}
                >
                  +
                </span>
              </button>
              <div
                className={cn(
                  "overflow-hidden transition-[max-height] duration-300 ease-snappy",
                  isOpen ? "max-h-[600px]" : "max-h-0",
                )}
              >
                <p className="m-0 max-w-[65ch] pb-7 text-[15px] leading-relaxed text-muted">
                  {t(`${item}.a`)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
