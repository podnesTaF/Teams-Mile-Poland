"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { FaqPlusIcon } from "./icons";

const ITEMS = ["noTeam", "kids", "prep", "bring", "spectator"] as const;

/** Accordion FAQ with the design's plus → x rotation animation. First item open by default. */
export function Faq() {
  const t = useTranslations("landing.faq");
  const [openIdx, setOpenIdx] = useState<number>(0);

  return (
    <section className="section" data-screen-label="FAQ">
      <div className="wrap center">
        <h2 className="head t-sec">{t("title")}</h2>
        <p className="sub-lead">{t("sub")}</p>
      </div>
      <div className="wrap">
        <div className="faq">
          {ITEMS.map((id, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div key={id} className={cn("qa", isOpen && "open")}>
                <button
                  type="button"
                  className="qa__head"
                  aria-expanded={isOpen}
                  onClick={() => setOpenIdx(isOpen ? -1 : idx)}
                >
                  <span className="qa__q">{t(`items.${id}.q`)}</span>
                  <span className="qa__ic">
                    <FaqPlusIcon />
                  </span>
                </button>
                <div className="qa__a">
                  <p>{t(`items.${id}.a`)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
