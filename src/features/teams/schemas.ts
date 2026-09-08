import { z } from "zod";

import { TEAM_CATEGORIES } from "./config";

/**
 * The team form, exactly as PRD #57 froze it. Shared by the client island
 * (`TeamForm`) and the server actions — the action re-parses, the island only
 * disables the button.
 *
 * `description` is `optional().or(literal(""))` rather than `default("")`
 * because the form always sends a string and the column is nullable: the action
 * maps `""` to `null` on the way in.
 */
export const teamFormSchema = z.object({
  name: z.string().trim().min(3).max(60),
  region: z.string().trim().min(2).max(60),
  category: z.enum(TEAM_CATEGORIES),
  recruiting: z.boolean(),
  description: z.string().trim().max(280).optional().or(z.literal("")),
});

export type TeamFormInput = z.infer<typeof teamFormSchema>;

/**
 * Editing a team. Category is **absent by construction**, not merely ignored:
 * it is immutable (PRD #57, "Category is immutable and drives the rules") and
 * `user_team_members.category` is a copy of it, so a change would have to
 * rewrite every membership row and could break the `(user_id, category)`
 * uniqueness of members who hold another team in the new category.
 *
 * zod strips unknown keys, so a crafted payload carrying `category` loses it
 * here before `updateTeam` ever sees it.
 */
export const teamUpdateSchema = teamFormSchema.omit({ category: true });

export type TeamUpdateInput = z.infer<typeof teamUpdateSchema>;
