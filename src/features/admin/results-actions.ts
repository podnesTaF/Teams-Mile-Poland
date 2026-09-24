"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { revalidateStartList } from "@/features/event-heats/start-list";
import { getEventBySlug } from "@/lib/events/registry";
import { formatTime } from "@/lib/events/time";

import { adminPath, requireAdmin, safeLocale } from "./action-helpers";
import {
  replaceHeatResults,
  replaceTeamHeatResults,
  resolveRegistrations,
  resolveTeamResults,
  unknownHeatNumbers,
  type MatchSource,
  type ResolvedRow,
  type ResolvedTeam,
} from "./results-import/data";
import { parseResultsFile, type RowError } from "./results-import/parse";
import { acceptsIndividuals } from "@/lib/events/types";

/**
 * The results-import actions (timing integration slice). Unlike the panel's
 * form-post actions, `previewResultsImport` is called from a client component
 * and *returns* its diagnostics — an upload has to be inspected before it is
 * committed, and a redirect cannot carry a table. `commitResultsImport` ends in
 * the usual flash redirect.
 */

/** One row of the preview table, ready to render. */
export type PreviewRow = {
  sourceRow: number;
  heat: number;
  bib: number | null;
  /** Team rows only: "AB Wilanów · #1 · 22:53.92", and the runner's role. */
  team?: string;
  role?: string;
  name: string;
  gender: "M" | "F";
  status: string;
  /** Formatted net time; "—" for DNF/DNS/DSQ. */
  time: string;
  place: number | null;
  /** How the row found its registration: bib lease, name, DoB, or not at all. */
  matchedBy: MatchSource;
};

export type ImportPreview =
  | { ok: false; errors: RowError[] }
  | {
      ok: true;
      rows: PreviewRow[];
      /** Row-level refusals — the file can still be committed without them. */
      errors: RowError[];
      /** Heat numbers with no event_heats row — usually a typo in the file. */
      unknownHeats: number[];
      heats: number;
      linked: number;
    };

/** The uploaded file, or null when the post carried none. */
async function fileFromForm(formData: FormData): Promise<{ name: string; buffer: Buffer } | null> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  return { name: file.name, buffer: Buffer.from(await file.arrayBuffer()) };
}

/** Parse + resolve an upload; shared by preview and commit so they cannot drift. */
async function parseAndResolve(
  eventSlug: string,
  formData: FormData,
): Promise<
  { rows: ResolvedRow[]; teams: ResolvedTeam[]; errors: RowError[] } | { fileError: string }
> {
  const file = await fileFromForm(formData);
  if (!file) return { fileError: "Choose a results file first." };

  const parsed = await parseResultsFile(file.name, file.buffer);
  if (parsed.rows.length === 0 && parsed.teams.length === 0) {
    return {
      fileError:
        parsed.errors[0]?.message ?? "The file contains no result rows the parser could read.",
    };
  }
  const [rows, teams] = await Promise.all([
    resolveRegistrations(eventSlug, parsed.rows),
    resolveTeamResults(eventSlug, parsed.teams),
  ]);
  return { rows, teams, errors: parsed.errors };
}

const ROLE_LABEL = { racer: "Racer", ace: "Pacer", joker: "Joker" } as const;

/** A team file flattened to preview rows, one per runner, team facts on each. */
function teamPreviewRows(teams: ResolvedTeam[]): PreviewRow[] {
  return teams.flatMap((t) =>
    t.runners.map((r) => ({
      sourceRow: r.sourceRow,
      heat: t.heat,
      bib: r.bib,
      team: `${t.name}${t.teamId ? "" : " (no platform team)"} · #${t.place ?? "—"} · ${
        t.timeCs === null ? t.status.toUpperCase() : formatTime(t.timeCs)
      }`,
      role: `${ROLE_LABEL[r.role]}${r.pairNo ? ` ${r.pairNo}` : ""}`,
      name: r.name,
      gender: r.gender,
      status: r.status,
      time:
        r.timeCs !== null
          ? formatTime(r.timeCs)
          : r.legTimeCs !== null
            ? `${formatTime(r.legTimeCs)} (leg)`
            : "—",
      place: null,
      matchedBy: r.matchedBy,
    })),
  );
}

/**
 * Dry-run an upload: everything the commit would do, minus the write. Returns
 * the preview the admin inspects before pressing Import.
 */
export async function previewResultsImport(
  eventSlug: string,
  formData: FormData,
): Promise<ImportPreview> {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale, "edit");
  const event = await getEventBySlug(eventSlug);
  if (!acceptsIndividuals(event)) {
    return { ok: false, errors: [{ sourceRow: 0, message: "Unknown event." }] };
  }

  const outcome = await parseAndResolve(eventSlug, formData);
  if ("fileError" in outcome) {
    return { ok: false, errors: [{ sourceRow: 0, message: outcome.fileError }] };
  }

  const heatNumbers = [
    ...new Set([...outcome.rows.map((r) => r.heat), ...outcome.teams.map((t) => t.heat)]),
  ].sort((a, b) => a - b);
  const teamRunners = outcome.teams.flatMap((t) => t.runners);
  return {
    ok: true,
    rows: [
      ...outcome.rows
        .slice()
        .sort((a, b) => a.heat - b.heat || (a.place ?? Infinity) - (b.place ?? Infinity))
        .map((r) => ({
          sourceRow: r.sourceRow,
          heat: r.heat,
          bib: r.bib,
          name: r.name,
          gender: r.gender,
          status: r.status,
          time: r.timeCs === null ? "—" : formatTime(r.timeCs),
          place: r.place,
          matchedBy: r.matchedBy,
        })),
      ...teamPreviewRows(outcome.teams),
    ],
    errors: outcome.errors,
    // Team nights have no heat rows of their own (the teams raced as the
    // timing file grouped them), so the warning only means something for
    // individual heats.
    unknownHeats: outcome.rows.length > 0 ? await unknownHeatNumbers(eventSlug, heatNumbers) : [],
    heats: heatNumbers.length,
    linked: [...outcome.rows, ...teamRunners].filter((r) => r.registrationId !== null).length,
  };
}

/**
 * Commit an upload: replace every heat the file carries, then invalidate the
 * public surfaces that render results — the landing leaderboard and the
 * profile results cards read these rows now.
 */
export async function commitResultsImport(eventSlug: string, formData: FormData): Promise<void> {
  const locale = safeLocale(formData.get("locale"));
  await requireAdmin(locale, "edit");
  const event = await getEventBySlug(eventSlug);
  const resultsPage = adminPath(locale, `/events/${eventSlug}/results`);
  if (!acceptsIndividuals(event)) {
    redirect(`${resultsPage}?error=input`);
  }

  const outcome = await parseAndResolve(eventSlug, formData);
  if ("fileError" in outcome) {
    redirect(`${resultsPage}?error=resultsfile`);
  }

  // One file is one layout: the parser returns individual rows or team blocks.
  const { heats, rows } =
    outcome.teams.length > 0
      ? await replaceTeamHeatResults(eventSlug, outcome.teams)
      : await replaceHeatResults(eventSlug, outcome.rows);

  // The landing renders the leaderboard (and the hero its "results" link);
  // profile pages are per-session dynamic and need no invalidation.
  revalidatePath("/[locale]", "page");
  revalidatePath(resultsPage);
  // The public per-event results page is force-dynamic (fresh on every
  // request), but the two cached pages that *link* to it — the event detail
  // page and the start list — flip their "Results" link on the first import,
  // so both re-render now. The results route itself is included for the day
  // it gains a cache profile: today the call is a harmless no-op.
  revalidatePath("/[locale]/events/[slug]", "page");
  revalidatePath("/[locale]/events/[slug]/results", "page");
  revalidateStartList();

  const skipped = outcome.errors.length;
  redirect(`${resultsPage}?ok=resultsimported&rows=${rows}&heats=${heats}&skipped=${skipped}`);
}
