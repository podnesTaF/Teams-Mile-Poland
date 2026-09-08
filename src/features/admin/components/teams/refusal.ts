import type { TeamActionReason } from "@/features/teams/config";

/**
 * English copy for every `TeamActionReason`, for the admin team islands (#63).
 *
 * The team feature's own refusals are message *keys* rendered from
 * `teams.reasons.<reason>` in the runner's locale. Admin is English-only by
 * convention (cross-cutting checklist §1), so `/admin/teams` cannot use that
 * catalog: on `/pl/admin/teams` a next-intl translator would answer in Polish
 * and the panel would be half-translated. This is that one namespace restated
 * in the panel's own voice — an organiser is told which *team* rule refused
 * them, which is a different sentence from the one the runner gets.
 *
 * **Total over `TeamActionReason` on purpose**: adding a reason is a compile
 * error here until the panel has a sentence for it.
 */
const REFUSALS: Record<TeamActionReason, string> = {
  auth: "You are signed out. Sign in again and retry.",
  verify: "That account has not verified its email address.",
  profile: "That account's profile is incomplete.",
  age: "That account is under 18.",
  notfound: "The team, invitation or request no longer exists.",
  forbidden: "Refused: team changes need full admin access.",
  name_taken: "Another team already has that name.",
  roster_full: "The roster and its open invitations already claim every seat.",
  sex_balance: "A mixed team needs at least four of each sex, and this would break that.",
  wrong_category: "This runner's sex does not fit the team's category.",
  already_member: "That runner is already on this roster.",
  already_in_category: "That runner already holds a team in this category.",
  expired: "That invitation has expired. Resend it to issue a fresh link.",
  used: "That invitation or request has already been answered.",
  manager_must_hand_over: "Hand management over before removing the manager.",
  invalid: "That value was rejected — check the field and try again.",
};

/** The panel's sentence for a refused team action. */
export function adminTeamRefusal(reason: TeamActionReason): string {
  return REFUSALS[reason];
}
