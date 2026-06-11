"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Standard participant prize table — 16 rating levels × position times ×
 * per-place euro prizes. Columns:
 *   [level, men-runners, men-aceJoker, women-runners, women-aceJoker,
 *    mix-runners, mix-aceJoker, place1, place2, place3]
 * Data is locale-independent (times / euros), so it lives here rather than
 * in the message catalogue. The rainbow level-column accent is CSS-driven
 * (`.pstd tbody tr:nth-child(n) .lvl`).
 */
const PSTD_ROWS: ReadonlyArray<readonly [number, ...string[]]> = [
  [16, "> 8:00:00", "> 7:30:00", "> 9:00:00", "> 8:34:00", "> 8:00:00", "> 8:34:00", "€150", "€100", "€50"],
  [15, "7:00:00", "7:30:00", "8:20:00", "8:34:00", "7:00:00", "8:34:00", "€150", "€100", "€50"],
  [14, "6:20:00", "6:30:00", "7:40:00", "7:54:00", "6:20:00", "7:54:00", "€200", "€150", "€100"],
  [13, "5:50:00", "5:50:00", "7:00:00", "7:14:00", "5:50:00", "7:14:00", "€250", "€200", "€150"],
  [12, "5:30:00", "5:20:00", "6:42:00", "6:34:00", "5:30:00", "6:34:00", "€300", "€250", "€200"],
  [11, "5:18:00", "5:00:00", "6:30:00", "6:16:00", "5:18:00", "6:16:00", "€350", "€300", "€250"],
  [10, "5:09:00", "4:47:00", "6:18:00", "6:04:00", "5:09:00", "6:04:00", "€400", "€350", "€300"],
  [9, "5:00:00", "4:39:00", "6:06:00", "5:50:00", "5:00:00", "5:50:00", "€500", "€400", "€350"],
  [8, "4:51:00", "4:30:00", "5:54:00", "5:38:00", "4:51:00", "5:38:00", "€600", "€500", "€400"],
  [7, "4:42:00", "4:21:00", "5:42:00", "5:26:00", "4:42:00", "5:26:00", "€700", "€600", "€500"],
  [6, "4:34:00", "4:12:00", "5:30:00", "5:16:00", "4:34:00", "5:16:00", "€800", "€700", "€600"],
  [5, "4:28:00", "4:08:00", "5:18:00", "5:04:00", "4:28:00", "5:04:00", "€1,000", "€800", "€700"],
  [4, "4:22:00", "4:02:00", "5:06:00", "4:54:00", "4:22:00", "4:54:00", "€1,200", "€1,000", "€800"],
  [3, "4:15:00", "3:57:00", "4:54:00", "4:40:00", "4:15:00", "4:40:00", "€1,500", "€1,200", "€1,000"],
  [2, "4:09:00", "3:52:00", "4:45:00", "4:28:00", "4:09:00", "4:28:00", "€2,000", "€1,500", "€1,200"],
  [1, "4:02:00", "3:46:00", "4:38:00", "4:19:00", "4:02:00", "4:19:00", "€2,500", "€2,000", "€1,500"],
];

/**
 * The two "prize fund" outline buttons under the rating-path band, plus the
 * standard prize-table modal they open. Both buttons reveal the same
 * standard participant table (the only table the design provides).
 */
export function PrizeFundCta() {
  const t = useTranslations("landing.ratingPath");
  const tm = useTranslations("landing.prizeModal");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <div className="rp-cta">
        <span className="head t-20 red rp-cta__kicker">{t("kicker")}</span>
        <div className="rp-cta__btns">
          <button className="btn btn-stroke" type="button" onClick={() => setOpen(true)}>
            {t("ctaIndividual")}
          </button>
          <button className="btn btn-stroke" type="button" onClick={() => setOpen(true)}>
            {t("ctaTeam")}
          </button>
        </div>
      </div>

      {open ? (
        <div className="prize-modal">
          <div className="prize-modal__backdrop" onClick={() => setOpen(false)} />
          <div
            className="prize-modal__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="prizeTitle"
          >
            <button
              className="prize-modal__close"
              type="button"
              onClick={() => setOpen(false)}
              aria-label={tm("close")}
            >
              ×
            </button>
            <div className="prize-head">
              <h2 className="prize-title" id="prizeTitle">
                {tm("title")}
              </h2>
            </div>
            <div className="pstd-scroll">
              <table className="pstd">
                <colgroup>
                  <col className="c-lvl" />
                  <col span={6} className="c-pos" />
                  <col span={3} className="c-prize" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="lvl-h" rowSpan={4}>
                      {tm("levelHead")}
                    </th>
                    <th className="pos-h" colSpan={6}>
                      {tm("positionHead")}
                    </th>
                    <th className="prize-h" colSpan={3} rowSpan={2}>
                      {tm("prizeHead")}
                    </th>
                  </tr>
                  <tr>
                    <th className="rating-h" colSpan={6}>
                      {tm("ratingHead")}
                    </th>
                  </tr>
                  <tr>
                    <th className="grp grp--men" colSpan={2}>
                      {tm("men")}
                    </th>
                    <th className="grp grp--women" colSpan={2}>
                      {tm("women")}
                    </th>
                    <th className="grp grp--mix" colSpan={2}>
                      {tm("mix")}
                    </th>
                    <th className="place-h" rowSpan={2}>
                      {tm("place1")}
                    </th>
                    <th className="place-h" rowSpan={2}>
                      {tm("place2")}
                    </th>
                    <th className="place-h" rowSpan={2}>
                      {tm("place3")}
                    </th>
                  </tr>
                  <tr className="sub">
                    <th>{tm("runners")}</th>
                    <th>{tm("aceJoker")}</th>
                    <th>{tm("runners")}</th>
                    <th>{tm("aceJoker")}</th>
                    <th>{tm("runnersMen")}</th>
                    <th>{tm("aceJokerWomen")}</th>
                  </tr>
                </thead>
                <tbody>
                  {PSTD_ROWS.map((row) => (
                    <tr key={row[0]}>
                      <th className="lvl">{row[0]}</th>
                      {row.slice(1, 7).map((cell, i) => (
                        <td key={i}>{cell}</td>
                      ))}
                      {row.slice(7, 10).map((cell, i) => (
                        <td key={i} className="pz">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pstd-notes">
              <p>
                <span className="nt nt--1">NOTE 1</span> {tm("notes.one")}
              </p>
              <p>
                <span className="nt nt--2">NOTE 2</span> {tm("notes.two")}
              </p>
              <p>
                <span className="nt nt--3">NOTE 3</span> {tm("notes.three")}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
