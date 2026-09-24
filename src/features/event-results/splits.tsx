import { getTranslations } from "next-intl/server";

import { formatTime } from "@/lib/events/time";
import type { ResultSplitPoint } from "@/lib/events/types";

/** Under a minute as the timing sheet prints it ("16.87"), otherwise m:ss.hh. */
function formatSplit(cs: number): string {
  return cs < 6000 ? (cs / 100).toFixed(2) : formatTime(cs).replace(/^0/, "");
}

/**
 * A runner's timing-point readings behind a native `<details>` disclosure —
 * closed by default, no client JS, so it works in the server-rendered results
 * tables and profile cards alike. Shared by `/events/[slug]/results`, the
 * completed event page's archive and the profile's result cards so the three
 * cannot drift.
 *
 * Each line is a mat: its distance, the gun-relative cumulative time there,
 * and the lap since the previous mat. The lap is left blank for the first
 * reading of a leg that starts mid-race (a JOKER's first mat): there is no
 * earlier reading of *this* runner to subtract.
 *
 * Styles: `.res-splits*` in `series-flows.css`, which every rendering page
 * imports.
 */
export async function SplitsDetails({ splits }: { splits: ResultSplitPoint[] | null | undefined }) {
  if (!splits || splits.length === 0) return null;
  const t = await getTranslations("events");
  const startsAtLine = splits[0].m < 100;

  return (
    <details className="res-splits">
      <summary className="res-splits__toggle">{t("results.splits")}</summary>
      <table className="res-splits__table">
        <thead>
          <tr>
            <th scope="col">{t("results.colDistance")}</th>
            <th scope="col">{t("results.colSplit")}</th>
            <th scope="col">{t("results.colLap")}</th>
          </tr>
        </thead>
        <tbody>
          {splits.map((split, i) => {
            const lap =
              i > 0 ? split.cs - splits[i - 1].cs : startsAtLine ? split.cs : null;
            return (
              <tr key={split.m}>
                <td>{split.m} m</td>
                <td>{formatSplit(split.cs)}</td>
                <td>{lap === null ? "—" : formatSplit(lap)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </details>
  );
}
