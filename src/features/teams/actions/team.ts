"use server";

import { customAlphabet } from "nanoid";
import { eq } from "drizzle-orm";

import { userTeamMembers, userTeams } from "@/db/schema/user-teams";
import { slugify } from "@/features/admin/news-slug";
import { getDb } from "@/lib/db";

import {
  TEAM_CODE_ALPHABET,
  TEAM_CODE_LENGTH,
  teamFailure,
  type TeamActionResult,
} from "../config";
import { findTeamByName, getUserTeamCategories } from "../data";
import { checkEligibility } from "../eligibility";
import { requireTeamActor, requireTeamManagerOrAdmin } from "../guards";
import { teamFormSchema, teamUpdateSchema, type TeamFormInput, type TeamUpdateInput } from "../schemas";

/**
 * Team lifecycle actions: create, edit, rotate the code. Invitations (#60),
 * join requests (#61), roster changes (#62) each get their own `actions/` file
 * — never a shared one.
 *
 * Every export returns the frozen shape `{ ok: true, … } | { ok: false, reason,
 * message }` and never redirects or throws for an expected refusal.
 */

const newCode = customAlphabet(TEAM_CODE_ALPHABET, TEAM_CODE_LENGTH);

/** Postgres unique-violation. Drizzle surfaces the driver error unchanged. */
function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const code = (error as { code?: string })?.code;
  if (code !== "23505") return false;
  if (!constraint) return true;
  const detail = `${(error as { constraint_name?: string }).constraint_name ?? ""} ${
    (error as { constraint?: string }).constraint ?? ""
  } ${(error as { message?: string }).message ?? ""}`;
  return detail.includes(constraint);
}

/**
 * A slug is generated once from the name and never rewritten, so collisions are
 * resolved here rather than by re-slugging later: `warsaw-aces`, then
 * `warsaw-aces-2`, `warsaw-aces-3`. Names are unique case-insensitively, so a
 * collision only happens when two different names slugify the same way
 * ("Warsaw Aces" vs "Warsaw  Aces!").
 */
async function uniqueSlug(name: string): Promise<string> {
  const db = getDb();
  const base = slugify(name) || "team";
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const [taken] = await db
      .select({ slug: userTeams.slug })
      .from(userTeams)
      .where(eq(userTeams.slug, candidate))
      .limit(1);
    if (!taken) return candidate;
  }
  // 50 teams sharing one slug base is not a real situation; fall back to a
  // code-shaped suffix rather than looping forever.
  return `${base}-${newCode().toLowerCase()}`;
}

/** A code nobody holds. The alphabet gives 32^6 ≈ 1.07e9 — collisions are rare. */
async function uniqueCode(): Promise<string> {
  const db = getDb();
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = newCode();
    const [taken] = await db
      .select({ code: userTeams.code })
      .from(userTeams)
      .where(eq(userTeams.code, candidate))
      .limit(1);
    if (!taken) return candidate;
  }
  throw new Error("Could not allocate a free team code");
}

/**
 * Create a team. The creator becomes its manager and its first member — which
 * is why the create path runs `checkEligibility` against an empty roster: a man
 * may not create a women's team, and nobody may create a second team in a
 * category they already hold.
 *
 * Team row and manager membership are written in **one transaction**: a team
 * with no manager on its roster would be unreachable and uncountable.
 */
export async function createTeam(input: TeamFormInput): Promise<TeamActionResult<{ slug: string }>> {
  const actor = await requireTeamActor();
  if (!actor.ok) return actor;

  const parsed = teamFormSchema.safeParse(input);
  if (!parsed.success) return teamFailure("invalid");
  const { name, region, category, recruiting, description } = parsed.data;

  const eligibility = checkEligibility(
    { category },
    [],
    {
      userId: actor.userId,
      sex: actor.sex,
      categories: await getUserTeamCategories(actor.userId),
    },
  );
  if (!eligibility.ok) return teamFailure(eligibility.reason);

  // Checked before the insert so the common case is a message, not a caught
  // 23505; the unique index below is what actually makes it true under a race.
  if (await findTeamByName(name)) return teamFailure("name_taken");

  const slug = await uniqueSlug(name);
  const code = await uniqueCode();
  const db = getDb();

  try {
    await db.transaction(async (tx) => {
      const [team] = await tx
        .insert(userTeams)
        .values({
          slug,
          code,
          name,
          region,
          category,
          recruiting,
          description: description ? description : null,
          managerUserId: actor.userId,
        })
        .returning({ id: userTeams.id });

      await tx.insert(userTeamMembers).values({
        teamId: team.id,
        userId: actor.userId,
        role: "manager",
        category,
      });
    });
  } catch (error) {
    if (isUniqueViolation(error, "user_teams_name_lower_uq")) return teamFailure("name_taken");
    if (isUniqueViolation(error, "user_team_members_user_category_uq")) {
      return teamFailure("already_in_category");
    }
    throw error;
  }

  return { ok: true, slug };
}

/**
 * Edit name, region, recruiting and description. **Never category** — it is not
 * in `teamUpdateSchema` and zod strips it from a crafted payload. **Never the
 * slug** either: renaming must not move the URL a manager already shared.
 */
export async function updateTeam(
  slug: string,
  input: TeamUpdateInput,
): Promise<TeamActionResult<{ slug: string }>> {
  const gate = await requireTeamManagerOrAdmin(slug);
  if (!gate.ok) return gate;

  const parsed = teamUpdateSchema.safeParse(input);
  if (!parsed.success) return teamFailure("invalid");
  const { name, region, recruiting, description } = parsed.data;

  if (await findTeamByName(name, gate.team.id)) return teamFailure("name_taken");

  const db = getDb();
  try {
    await db
      .update(userTeams)
      .set({
        name,
        region,
        recruiting,
        description: description ? description : null,
        updatedAt: new Date(),
      })
      .where(eq(userTeams.id, gate.team.id));
  } catch (error) {
    if (isUniqueViolation(error, "user_teams_name_lower_uq")) return teamFailure("name_taken");
    throw error;
  }

  return { ok: true, slug: gate.team.slug };
}

/**
 * Issue a fresh code. The old one stops resolving immediately; join requests
 * already filed reference the team, not the code, so a rotation never
 * invalidates a pending request (PRD #57, user story 16).
 */
export async function rotateTeamCode(slug: string): Promise<TeamActionResult<{ code: string }>> {
  const gate = await requireTeamManagerOrAdmin(slug);
  if (!gate.ok) return gate;

  const code = await uniqueCode();
  const db = getDb();
  await db
    .update(userTeams)
    .set({ code, updatedAt: new Date() })
    .where(eq(userTeams.id, gate.team.id));

  return { ok: true, code };
}
