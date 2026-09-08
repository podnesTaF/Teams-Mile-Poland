# How a runner gets into a team

Teams are formed on the platform before any race exists. This page describes who does what, in order. It is the agreed flow behind PRD #57 (slices #58–#63).

Who acts in each step: **Runner**, **Manager**, **Platform**. Things marked **Later** are not part of this release.

## What a team is

A team is a named group of runners with one manager. It is created once and lives on until it is dissolved. It is not tied to one race: the team enters races later, as a unit.

Every team has a **category**, chosen at creation and never changed. The category decides who may join and how many runners the team needs.

| Category | Who may join   | Minimum to be complete | Maximum | Extra rule                    |
|----------|----------------|-----------------------:|--------:|-------------------------------|
| Men      | Men            | 7                      | 11      | —                             |
| Women    | Women          | 7                      | 11      | —                             |
| Mixed    | Men and women  | 8                      | 12      | At least 4 men and 4 women    |

A runner can be in **one team of their own sex category and one mixed team** at the same time. Not two men's teams, not two mixed teams.

## Step 1 · Someone creates the team

Any signed-in runner with a complete profile who is 18 or older can create a team. The creator becomes the manager and is the first member.

1. **Runner** fills in the form: team name, region, category, and a short description. Team names must be unique.
2. **Runner** answers one question: *"Do you already have all your teammates, or are you looking for runners?"*
3. **Platform** creates the team immediately. No approval step. The creator is now **Manager** and receives a team code and a share link.
4. **Platform** lists the team on the public **Teams** page if the manager said "looking for runners", so others can find it. The manager can switch this on or off at any time.

## Step 2 · Runners come in through one of two doors

Both doors end the same way: the manager decides, and the platform checks the rules. A person is never added to a team without the manager's say and their own.

### Door A · Invitation (the manager reaches out)

1. **Manager** types a runner's email on the team page and presses **Invite**. The organiser can do the same on the team's behalf.
2. **Platform** sends an email with a personal link. The link works once and expires after 30 days. The manager can resend or cancel it.
3. **Runner** opens the link.
   - *Already has an account:* sees the team and presses **Accept** or **Decline**.
   - *No account yet:* is asked to sign up with the email pre-filled, confirms their email, completes their profile, and lands back on the same Accept screen.
4. **Platform** checks the rules (below). If they pass, the runner is a member. The manager gets an email.

### Door B · Ask to join (the runner reaches out)

1. **Runner** either enters a **team code** the manager shared, or finds the team on the public **Teams** page and presses **Ask to join**. Must be signed in with a complete profile.
2. **Platform** checks the rules first. If the runner is not eligible (wrong category, team full, already in a team of that category), it says so right away and no request is made.
3. **Manager** sees the request in a queue on the team page and gets an email. Presses **Accept** or **Decline**.
4. **Platform** re-checks the rules at the moment of acceptance, adds the member, and emails the runner the decision.

> The team code only lets someone *ask*. Knowing the code never puts anyone on the team. The manager can change the code at any time if it leaks; requests already made are not affected.

## Rules the platform enforces automatically

- The runner's sex matches the category. Men's teams take men, women's teams take women, mixed teams take both.
- The team is below its maximum (11, or 12 for mixed).
- On a mixed team, there is still room for at least 4 of each sex. In practice: never more than 8 men or 8 women.
- The runner is not already in another team of the same category.
- The runner is 18 or older and has a complete profile (name, date of birth, sex, phone).
- Open invitations never exceed empty seats, so a full team cannot build a waiting list.

"Complete" means the team has reached its minimum. It is shown on the team page as, for example, "7 of 7 — complete" or "5 of 8 — 3 more needed". Nobody has to press anything to become complete.

## Changes after joining

| Action | Who | What happens |
|---|---|---|
| Leave the team | Runner | One click with confirmation. The runner may be invited or ask again later. |
| Remove a member | Manager | The member is taken off the roster and emailed. |
| Hand over management | Manager | Another member becomes manager; the old manager stays as a member. The new manager is emailed. |
| Manager leaves | Manager | Not allowed while others remain. Hand over first, then leave. |
| Dissolve the team | Manager | The team is deleted, every member is emailed, open invitations and requests are cancelled. |
| Rename, edit region or description, switch "looking for runners" | Manager | Immediate. The team's web address does not change on rename. |

The organiser (admin) can do all of the above on any team, and can invite a runner to a team on the manager's behalf.

## What people see

- **Everyone** can see the public Teams page and any team's card: name, region, category, how many runners it has, its description, and the manager's first name.
- **Members** also see the full roster with names, the team code, and the share link.
- **The manager** also sees the invitation list, the request queue, and the management buttons.
- **Runners** see their own teams, pending invitations, and pending requests on their profile.
- Roster names are never shown publicly at this stage.

## Not in this step (Later)

- **Entering a race.** A complete team registers for a team event as a unit. Each member confirms the race documents individually.
- **Race line-up and roles.** The 7 (or 8) who actually run, and who is RACER, ACE or JOKER, are fixed at check-in on race day, not when the team is formed. The rules' "Captain" (the runner who speaks for the team on race day) is chosen there too; it is not the same as the manager.
- **Team results and rankings.** Come with the first team race.
- **Coach, manager-staff and other support roles, team logos, and the organiser building teams from solo runners.** Not in this release.

---

Source of record: GitHub issue #57 (Team formation PRD), slices #58–#63, and the "Teams (current)" section of `CONTEXT.md`. The team rules document still states "complete at 11 / 12" and requires the region in the team name; that text is being corrected to match the numbers and behaviour above.
