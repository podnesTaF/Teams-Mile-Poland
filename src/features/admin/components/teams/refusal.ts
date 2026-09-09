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
  // Team entry and race day (PRD #64).
  incomplete_team: "The team is not complete — it has not reached its roster minimum.",
  not_open: "That event is not open for registration.",
  already_entered: "That team is already entered in this event.",
  member_underage: "A member of that team will be under 18 on the event date.",
  already_checked_in: "That entry is checked in; its roster is locked.",
  consent_pending: "A composed member has not confirmed their participation yet.",
  invalid_composition: "The composition breaks the rules — see the specific reason.",
  bib_pool: "The bib pool cannot cover this composition.",
  heat_started: "That heat has already started; no swaps.",
  not_reserve: "The runner coming in must be a reserve on this entry.",
  remind_limit: "A reminder already went out to that member in the last 24 hours.",
  already_confirmed: "That member has already confirmed.",
  cancelled: "That event is cancelled.",
  registered_individually:
    "A member of that team is already registered individually for this event — one entry per runner per night.",
};

/** The panel's sentence for a refused team action. */
export function adminTeamRefusal(reason: TeamActionReason): string {
  return REFUSALS[reason];
}
