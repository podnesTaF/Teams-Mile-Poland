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
 * Team divisions prize table — 8 leagues, each with two team levels (2 and 1).
 * Per league: a total prize fund, the four AB-mile rating-time bands
 * (male min / male max / female / mixed / 1-mile-male) per level, and the
 * per-place + team euro prizes (shared across both levels, so rendered with a
 * vertical row span). Like {@link PSTD_ROWS} the numbers are locale-independent
 * and live here; only labels come from the catalogue. `accent` drives the
 * coloured left edge of the league cell.
 */
type TeamLevelRow = readonly [
  level: string,
  maleMin: string,
  maleMax: string,
  female: string,
  mixed: string,
  mile: string,
];
type TeamDivision = {
  league: string;
  accent: string;
  total: string;
  place1: string;
  place2: string;
  place3: string;
  teamFund: string;
  levels: readonly [TeamLevelRow, TeamLevelRow];
};

const TEAM_DIVISIONS: ReadonlyArray<TeamDivision> = [
  {
    league: "BEGINNER",
    accent: "#2aa6a0",
    total: "€5,000",
    place1: "€150",
    place2: "€100",
    place3: "€50",
    teamFund: "€4,700",
    levels: [
      ["2", "> 31:00", "—", "> 45:00", "> 37:00", "> 8:00"],
      ["1", "28:30 - 31:00", "29:30 - 31:00", "36:20 - 40:00", "35:20 - 36:00", "6:20 - 7:00"],
    ],
  },
  {
    league: "ASPIRING RUNNER",
    accent: "#54b94f",
    total: "€7,500",
    place1: "€200",
    place2: "€150",
    place3: "€100",
    teamFund: "€7,050",
    levels: [
      ["2", "27:30 - 28:30", "28:30 - 29:30", "34:00 - 36:20", "34:00 - 34:40", "5:50 - 6:20"],
      ["1", "26:30 - 27:30", "27:30 - 28:30", "31:46 - 34:00", "34:10 - 34:40", "5:50 - 5:50"],
    ],
  },
  {
    league: "ADVANCED RUNNER",
    accent: "#2f8ac9",
    total: "€10,000",
    place1: "€250",
    place2: "€200",
    place3: "€150",
    teamFund: "€9,400",
    levels: [
      ["2", "25:30 - 26:30", "26:30 - 27:30", "30:30 - 31:46", "33:12 - 34:10", "5:18 - 5:30"],
      ["1", "24:45 - 25:30", "25:30 - 26:30", "30:30 - 30:30", "32:13 - 33:12", "5:09 - 5:18"],
    ],
  },
  {
    league: "HALF-PRO",
    accent: "#5a57c9",
    total: "€15,000",
    place1: "€300",
    place2: "€250",
    place3: "€200",
    teamFund: "€14,250",
    levels: [
      ["2", "24:00 - 24:45", "24:45 - 25:30", "30:30 - 31:20", "31:20 - 32:16", "5:00 - 5:09"],
      ["1", "23:15 - 24:00", "24:00 - 24:45", "29:30 - 30:30", "30:24 - 31:20", "4:51 - 5:00"],
    ],
  },
  {
    league: "SEMI-PROFESSIONAL",
    accent: "#6b3fd0",
    total: "€30,000",
    place1: "€350",
    place2: "€300",
    place3: "€250",
    teamFund: "€29,100",
    levels: [
      ["2", "22:30 - 23:15", "23:15 - 24:00", "28:30 - 29:30", "29:28 - 30:24", "4:42 - 4:51"],
      ["1", "22:00 - 22:30", "22:30 - 23:15", "28:28 - 29:28", "28:34 - 29:28", "4:34 - 4:42"],
    ],
  },
  {
    league: "PROFESSIONAL",
    accent: "#ef6f27",
    total: "€50,000",
    place1: "€400",
    place2: "€350",
    place3: "€300",
    teamFund: "€48,950",
    levels: [
      ["2", "21:30 - 22:00", "22:00 - 22:30", "27:52 - 28:34", "27:12 - 27:52", "4:22 - 4:28"],
      ["1", "21:00 - 21:30", "21:30 - 22:00", "25:30 - 26:30", "27:12 - 27:52", "4:22 - 4:28"],
    ],
  },
  {
    league: "ELITE",
    accent: "#e23b2e",
    total: "€70,000",
    place1: "€1,500",
    place2: "€1,000",
    place3: "€500",
    teamFund: "€67,000",
    levels: [
      ["2", "20:29 - 21:00", "21:00 - 21:30", "26:20 - 27:12", "24:46 - 25:10", "4:15 - 4:22"],
      ["1", "19:59 - 20:29", "20:29 - 21:00", "23:30 - 24:46", "23:30 - 24:46", "4:08 - 4:15"],
    ],
  },
  {
    league: "TOP ELITE",
    accent: "#b02016",
    total: "€100,000",
    place1: "€2,000",
    place2: "€1,500",
    place3: "€1,000",
    teamFund: "€95,500",
    levels: [
      ["2", "19:26 - 19:59", "19:59 - 20:29", "25:10 - 25:40", "24:40 - 25:10", "4:08 - 4:12"],
      ["1", "< 19:26", "—", "24:40 - 25:10", "24:40 - 25:10", "< 4:02 - 4:09"],
    ],
  },
];

type OpenTable = null | "individual" | "team";

/**
 * The two "prize fund" outline buttons under the rating-path band, plus the
 * prize-table modals they open. The "individual prizes" button reveals the
 * standard participant table; "team prize funds" reveals the team divisions
 * table. Both share the same modal chrome.
 */
export function PrizeFundCta() {
  const t = useTranslations("landing.ratingPath");
  const tm = useTranslations("landing.prizeModal");
  const tt = useTranslations("landing.teamModal");
  const [open, setOpen] = useState<OpenTable>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Tell the fixed site header to hide while a modal covers the page.
    window.dispatchEvent(new CustomEvent("ace:modal", { detail: true }));
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      window.dispatchEvent(new CustomEvent("ace:modal", { detail: false }));
    };
  }, [open]);

  return (
    <>
      <div className="rp-cta">
        <span className="head t-20 red rp-cta__kicker">{t("kicker")}</span>
        <div className="rp-cta__btns">
          <button className="btn btn-stroke" type="button" onClick={() => setOpen("individual")}>
            {t("ctaIndividual")}
          </button>
          <button className="btn btn-stroke" type="button" onClick={() => setOpen("team")}>
            {t("ctaTeam")}
          </button>
        </div>
      </div>

      {open ? (
        <div className="prize-modal">
          <div className="prize-modal__backdrop" onClick={() => setOpen(null)} />
          <div
            className="prize-modal__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="prizeTitle"
          >
            <button
              className="prize-modal__close"
              type="button"
              onClick={() => setOpen(null)}
              aria-label={tm("close")}
            >
              ×
            </button>
            <div className="prize-head">
              <h2 className="prize-title" id="prizeTitle">
                {open === "team" ? tt("title") : tm("title")}
              </h2>
            </div>

            {open === "individual" ? (
              <>
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
              </>
            ) : (
              <>
                <div className="pstd-scroll">
                  <table className="pstd pstd--team">
                    <thead>
                      <tr>
                        <th className="pos-h" colSpan={3}>
                          {tt("divisionsHead")}
                        </th>
                        <th className="pos-h" colSpan={5}>
                          {tt("ratingHead")}
                        </th>
                        <th className="prize-h" colSpan={4}>
                          {tt("prizeHead")}
                        </th>
                      </tr>
                      <tr className="sub">
                        <th>{tt("leagues")}</th>
                        <th>{tt("teamLevels")}</th>
                        <th>{tt("prizeTotal")}</th>
                        <th>{tt("maleMin")}</th>
                        <th>{tt("maleMax")}</th>
                        <th>{tt("female")}</th>
                        <th>{tt("mixed")}</th>
                        <th>{tt("mile")}</th>
                        <th>{tt("place1")}</th>
                        <th>{tt("place2")}</th>
                        <th>{tt("place3")}</th>
                        <th>{tt("teamFund")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {TEAM_DIVISIONS.map((div) => (
                        div.levels.map((row, ri) => (
                          <tr key={`${div.league}-${row[0]}`}>
                            {ri === 0 ? (
                              <th
                                className="lg"
                                rowSpan={2}
                                style={{ borderLeftColor: div.accent }}
                              >
                                {div.league}
                              </th>
                            ) : null}
                            <td className="lvl-cell">{row[0]}</td>
                            {ri === 0 ? (
                              <td className="pz" rowSpan={2}>
                                {div.total}
                              </td>
                            ) : null}
                            {row.slice(1, 6).map((cell, i) => (
                              <td key={i}>{cell}</td>
                            ))}
                            {ri === 0 ? (
                              <>
                                <td className="pz" rowSpan={2}>
                                  {div.place1}
                                </td>
                                <td className="pz" rowSpan={2}>
                                  {div.place2}
                                </td>
                                <td className="pz" rowSpan={2}>
                                  {div.place3}
                                </td>
                                <td className="pz" rowSpan={2}>
                                  {div.teamFund}
                                </td>
                              </>
                            ) : null}
                          </tr>
                        ))
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="pstd-notes">
                  <p>
                    <span className="nt nt--1">NOTE 1</span> {tt("notes.one")}
                  </p>
                  <p>
                    <span className="nt nt--2">NOTE 2</span> {tt("notes.two")}
                  </p>
                  <p>
                    <span className="nt nt--3">NOTE 3</span> {tt("notes.three")}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
