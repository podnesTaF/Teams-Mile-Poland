/**
 * The TEAM DIVISIONS TABLE of the prize-fund rules — 8 leagues, each with two
 * team levels (2 and 1), and per league the AB-mile team-rating time bands
 * (male 5+2 min / max, female 5+2, mixed, 1-mile male) plus the euro prizes.
 *
 * One source for two readers: the landing's prize-fund modal renders the whole
 * table, and a published team run is rated against it (`teamDivisionFor`), so
 * the division under a team's result can never disagree with the table the
 * runner opens next to it. Numbers are locale-independent and live here; only
 * column labels come from the catalogue. `accent` drives the coloured left edge
 * of the league cell in the modal.
 */
export type TeamLevelRow = readonly [
  level: string,
  maleMin: string,
  maleMax: string,
  female: string,
  mixed: string,
  mile: string,
];

export type TeamDivision = {
  league: string;
  accent: string;
  total: string;
  place1: string;
  place2: string;
  place3: string;
  teamFund: string;
  levels: readonly [TeamLevelRow, TeamLevelRow];
};

export const TEAM_DIVISIONS: ReadonlyArray<TeamDivision> = [
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

/** Where a team run sits in the table: league, its 1-based column position, team level. */
export type TeamDivisionRating = {
  league: string;
  /** 1 = BEGINNER … 8 = TOP ELITE, as the table orders them. */
  division: number;
  /** 2 (slower band) or 1 (faster band) within the league. */
  level: number;
};

/**
 * The time-band column a team is rated on. A men's team reads the "Male Team
 * Time 5+2 (min)" column; a run with no linked platform team — a pick-up team
 * entered by the organiser — is rated as a men's team, which every team night
 * so far has been.
 */
const BAND_COLUMN: Record<string, 1 | 3 | 4> = { men: 1, women: 3, mixed: 4 };

const toCs = (mmss: string): number => {
  const [m, s] = mmss.split(":");
  return (Number(m) * 60 + Number(s)) * 100;
};

/**
 * Whether a time falls in a band as the table writes it: `a - b` is
 * `[a, b)` (bands are contiguous, so a time exactly on the boundary belongs
 * to the slower band), `> a` is `[a, ∞)`, `< b` is `(-∞, b)`, `—` is empty.
 */
function bandContains(band: string, timeCs: number): boolean {
  const times = band.match(/\d+:\d{2}/g)?.map(toCs) ?? [];
  if (times.length === 0) return false;
  if (band.trim().startsWith(">")) return timeCs >= times[0];
  if (band.trim().startsWith("<")) return timeCs < times[times.length - 1];
  if (times.length === 1) return timeCs === times[0];
  return timeCs >= times[0] && timeCs < times[1];
}

/**
 * The division and level a finished team run earns, by its time and the
 * category of its platform team (`user_teams.category`; null → men's bands).
 * Null when the time matches no band — the table's women's/mixed columns have
 * gaps, and a men's time is only ever outside it on a data error.
 */
export function teamDivisionFor(
  timeCs: number,
  category: string | null | undefined,
): TeamDivisionRating | null {
  const column = BAND_COLUMN[category ?? "men"] ?? BAND_COLUMN.men;
  for (const [index, division] of TEAM_DIVISIONS.entries()) {
    for (const row of division.levels) {
      if (bandContains(row[column], timeCs)) {
        return { league: division.league, division: index + 1, level: Number(row[0]) };
      }
    }
  }
  return null;
}

/** `ADVANCED RUNNER DIVISION-3 LEVEL 1` — the bracket of the rating line under a team result. */
export function formatTeamDivision(rating: TeamDivisionRating): string {
  return `${rating.league} DIVISION-${rating.division} LEVEL ${rating.level}`;
}
