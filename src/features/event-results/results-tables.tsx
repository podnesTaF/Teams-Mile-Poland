import { getTranslations } from "next-intl/server";

import type {
  PublicEventResults,
  PublicResultRow,
  PublicTeamResult,
} from "@/lib/events/results-data";
import { formatTime } from "@/lib/events/time";

import { SplitsDetails } from "./splits";

/**
 * The per-heat results tables — one `.sl-heat` card per heat, finishers in
 * place order then DNF/DSQ/DNS, plus the status legend. Shared by the
 * per-event results page (`/events/[slug]/results`, fresh on every request for
 * mid-event imports) and the completed event detail page, which inlines the
 * same tables as its archive view — extracted so the two surfaces cannot
 * drift.
 *
 * A heat that ran teams (ADR 0014) renders one block per team — place, name,
 * team time — with its runners in running order underneath: RACERS, then each
 * ACE + JOKER pair. Every runner with timing-point readings gets a "Splits"
 * disclosure under their name.
 *
 * Styling comes from `heats/heats.css` (`.sl-heats`, `.iv-table`) and
 * `series-flows.css` (`.res-splits`, `.sl-team`) — the rendering page imports
 * both and provides the `.iv` root.
 */
export async function ResultsTables({ results }: { results: PublicEventResults }) {
  const t = await getTranslations("events");
  const hasTeams = results.heats.some((h) => h.teams.length > 0);

  return (
    <>
      <div className="sl-heats">
        {results.heats.map((heat) => {
          const finishers = heat.rows.filter((r) => r.status === "finished").length;
          return (
            <article className="sl-heat" key={heat.number} data-results-heat={heat.number}>
              <header className="sl-heat__head">
                <h2 className="sl-heat__no">{t("results.heat", { number: heat.number })}</h2>
                <span className="sl-heat__count">
                  {heat.teams.length > 0
                    ? t("results.teams", { count: heat.teams.length })
                    : t("results.finishers", { count: finishers })}
                </span>
              </header>
              {heat.teams.map((team) => (
                <TeamBlock key={team.id} team={team} />
              ))}
              {heat.rows.length > 0 ? (
                <div className="iv-tablewrap">
                  <table className="iv-table sl-table">
                    <thead>
                      <tr>
                        <th>{t("results.colPlace")}</th>
                        <th>{t("results.colName")}</th>
                        <th>{t("results.colTime")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {heat.rows.map((row, i) => (
                        <tr key={row.id ?? `${row.bib}:${i}`}>
                          <td>{row.place ?? "—"}</td>
                          <td className="sl-table__name">
                            {row.name}
                            <SplitsDetails splits={row.splits} />
                          </td>
                          <td className={row.status === "finished" ? undefined : "sl-table__club"}>
                            {row.timeCs !== null && row.status === "finished"
                              ? formatTime(row.timeCs)
                              : row.status.toUpperCase()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      {hasTeams ? <p className="iv-meta sl-approx">{t("results.teamLegend")}</p> : null}
      <p className="iv-meta sl-approx">{t("results.legend")}</p>
    </>
  );
}

async function TeamBlock({ team }: { team: PublicTeamResult }) {
  const t = await getTranslations("events");
  return (
    <section className="sl-team" data-results-team={team.name}>
      <header className="sl-team__head">
        <span className="sl-team__place">{team.place ?? "—"}</span>
        <h3 className="sl-team__name">{team.name}</h3>
        <span className="sl-team__time">
          {team.timeCs !== null && team.status === "finished"
            ? formatTime(team.timeCs)
            : team.status.toUpperCase()}
        </span>
      </header>
      <div className="iv-tablewrap">
        <table className="iv-table sl-table">
          <thead>
            <tr>
              <th>{t("results.colRole")}</th>
              <th>{t("results.colName")}</th>
              <th>{t("results.colTime")}</th>
            </tr>
          </thead>
          <tbody>
            {team.members.map((row, i) => (
              <tr key={row.id ?? `${row.bib}:${i}`}>
                <td className="sl-table__club">{roleLabel(t, row)}</td>
                <td className="sl-table__name">
                  {row.name}
                  <SplitsDetails splits={row.splits} />
                </td>
                <td>{memberTime(t, row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type T = Awaited<ReturnType<typeof getTranslations<"events">>>;

function roleLabel(t: T, row: PublicResultRow): string {
  if (row.role === "ace") return t("results.role.ace", { pair: row.pairNo ?? "" });
  if (row.role === "joker") return t("results.role.joker", { pair: row.pairNo ?? "" });
  return t("results.role.racer");
}

/**
 * A RACER shows their mile; a JOKER the pair's mile (their finish); an ACE the
 * handover reading, labelled so it is never read as a mile.
 */
function memberTime(t: T, row: PublicResultRow) {
  if (row.status !== "finished") return row.status.toUpperCase();
  if (row.timeCs !== null) return formatTime(row.timeCs);
  if (row.legTimeCs == null) return "—";
  return (
    <>
      {formatTime(row.legTimeCs)}{" "}
      <span className="sl-table__club">
        {row.role === "ace" ? t("results.legHandover") : t("results.legPair")}
      </span>
    </>
  );
}
