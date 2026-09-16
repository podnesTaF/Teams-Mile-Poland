"use server";

import { eq } from "drizzle-orm";

import { userTeams } from "@/db/schema/user-teams";
import { TEAM_CREATION_PRICE_ACER, acerToMinor } from "@/features/wallet/config";
import { getAcerBalance } from "@/features/wallet/data";
import { getDb } from "@/lib/db";

import { teamFailure, type TeamActionResult } from "../config";
import {
  createTeamRows,
  isInsufficientAcer,
  isUniqueViolation,
  uniqueCode,
} from "../creation";
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

/**
 * Create a team. The creator becomes its manager and its first member — which
 * is why the create path runs `checkEligibility` against an empty roster: a man
 * may not create a women's team, and nobody may create a second team in a
 * category they already hold.
 *
 * Founding a team **costs `TEAM_CREATION_PRICE_ACER`**, debited from the
 * creator's wallet in the same transaction that writes the team and the manager
 * membership (`createTeamRows`). The balance is checked here as well, before the
 * transaction opens, so the everyday case is a message rather than a rollback;
 * the in-transaction re-read under the per-user lock is what actually makes the
 * check true when two creates race, and it comes back as the same refusal.
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

  // Read once and handed down, so the price the balance was judged against and
  // the price that is charged cannot differ — even across a deploy mid-request.
  const priceMinor = acerToMinor(TEAM_CREATION_PRICE_ACER);
  if (priceMinor > 0 && (await getAcerBalance(actor.userId)) < priceMinor) {
    return teamFailure("insufficient_balance");
  }

  let created;
  try {
    created = await createTeamRows({
      userId: actor.userId,
      name,
      region,
      category,
      recruiting,
      description,
      priceMinor,
    });
  } catch (error) {
    if (isInsufficientAcer(error)) return teamFailure("insufficient_balance");
    if (isUniqueViolation(error, "user_teams_name_lower_uq")) return teamFailure("name_taken");
    if (isUniqueViolation(error, "user_team_members_user_category_uq")) {
      return teamFailure("already_in_category");
    }
    throw error;
  }

  return { ok: true, slug: created.slug };
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
