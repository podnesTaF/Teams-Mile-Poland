/**
 * The roster row as the table and its detail drawer render it — every value
 * already a string, computed on the server.
 *
 * The roster table is a client island (it owns the selection and which row is
 * open), and a client island cannot reach `events-data.ts`: that module imports
 * Drizzle and ExcelJS, so a *value* import from it would drag both into the
 * browser bundle. Rather than re-implementing `ageCategoryForDob`, `holdsBib`
 * and the timestamp format on the other side of the boundary, the page maps its
 * `RosterRow[]` through here and hands over plain data — the same shape
 * `admin-nav.ts` hands the sidebar, and for the same reason.
 *
 * Everything a runner's drawer states is in here, including the values the table
 * itself does not show (phone, date of birth): the drawer is what buys the
 * compact table, and it renders from the row the page already read rather than
 * fetching one of its own.
 */

import {
  ageCategoryForDob,
  holdsBib,
  type ParticipationStatus,
  type RosterRow,
} from "./events-data";
import { formatAdminDateTime } from "./format";
import type { HeatWithFill } from "./heats-data";
import type { SeasonBest } from "./roster-best";
import { formatHeatTime } from "@/lib/events/heat-time";
import { formatTime } from "@/lib/events/time";

export type RosterRowView = {
  id: string;
  status: ParticipationStatus;
  /** Full name, or the single-field `name` for an account with neither part. */
  name: string;
  email: string;
  phone: string | null;
  club: string | null;
  sex: "M" | "F" | null;
  /** Age category against the event date; `""` when no date of birth is on file. */
  category: string;
  /** ISO date, as the xlsx export writes it; `""` when none is on file. */
  dateOfBirth: string;
  bib: number | null;
  /** Whether that bib is a live lease rather than a number they wore (ADR 0003). */
  holdsBib: boolean;
  /** `"Heat 3"`, or null for a runner who is not seeded. */
  heatLabel: string | null;
  /** Warsaw wall-clock start of that heat. */
  heatTime: string | null;
  /** Their heat has run — they are done, not waiting for a bib. */
  heatFinished: boolean;
  /**
   * Best mile of the qualification season — the runner's fastest matched result
   * across every event *other than this one* (`roster-best.ts`), formatted
   * `MM:SS.cc`; null when they have none. What a final's roster is seeded by.
   */
  seasonBest: string | null;
  /** The same best with its context for the drawer: "04:32.10 · Level 5 · 01 · 08 · 2026". */
  seasonBestDetail: string | null;
  registeredAt: string;
  checkedInAt: string;
};

export function toRosterRowView(
  row: RosterRow,
  eventDate: Date,
  best: SeasonBest | null = null,
): RosterRowView {
  return {
    id: row.id,
    status: row.status,
    name: [row.firstName, row.lastName].filter(Boolean).join(" ") || row.name,
    email: row.email,
    phone: row.phone,
    club: row.club,
    sex: row.sex,
    category: ageCategoryForDob(row.dateOfBirth, eventDate),
    dateOfBirth: row.dateOfBirth ? row.dateOfBirth.toISOString().slice(0, 10) : "",
    bib: row.bib,
    holdsBib: holdsBib(row),
    heatLabel: row.heatNumber === null ? null : `Heat ${row.heatNumber}`,
    heatTime: row.heatScheduledAt ? formatHeatTime(row.heatScheduledAt) : null,
    heatFinished: row.heatFinishedAt !== null,
    seasonBest: best ? formatTime(best.timeCs) : null,
    seasonBestDetail: best
      ? `${formatTime(best.timeCs)} · Level ${best.level} · ${best.shortDate}`
      : null,
    registeredAt: formatAdminDateTime(row.createdAt),
    checkedInAt: formatAdminDateTime(row.checkedInAt),
  };
}

/** One option in the bulk-assign form's target-heat picker. */
export type HeatOption = {
  id: string;
  /** `"Heat 2 · 18:40 · 9/12"` — the heat builder's own option label. */
  label: string;
  /**
   * Whether this heat has already been released to its runners. Moving somebody
   * into a published heat is what flags them "to notify", so the picker says so
   * rather than leaving the consequence to be discovered on the Heats tab.
   */
  published: boolean;
  /**
   * How full the heat is, and how full it can be.
   *
   * Carried so the picker can *say* what a move would do to the card:
   * `assignToHeat` does not check capacity — the builder has never blocked an
   * overfill either, it renders one — and inventing a refusal on this surface
   * would make the two paths behave differently (issue #41's Contracts:
   * inherited, not reimplemented).
   */
  fill: number;
  capacity: number;
};

export function toHeatOption(heat: HeatWithFill): HeatOption {
  return {
    id: heat.id,
    label: `Heat ${heat.number} · ${formatHeatTime(heat.scheduledAt)} · ${heat.fill}/${heat.capacity}`,
    published: heat.publishedAt !== null,
    fill: heat.fill,
    capacity: heat.capacity,
  };
}
