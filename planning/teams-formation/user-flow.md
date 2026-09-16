# How a runner gets into a team

Who acts in each step: **Runner**, **Manager**, **Platform**. Things marked **Later** are not part of this release.

Creating a team is a **paid feature**. It is **free during the launch window**, and the free path still runs through a real checkout — see [Step 1](#step-1--someone-creates-the-team) and [The launch coupon](#the-launch-coupon). Joining a team is free and always will be: only the creator ever sees a checkout.

## What a team is

A team is a named group of runners with one manager. It is created once and lives on until it is dissolved. It is not tied to one race: the team enters races later, as a unit.

Every team has a **category**, chosen at creation and never changed. The category decides who may join and how many runners the team needs.

| Category | Who may join  | Minimum to be complete | Maximum | Extra rule                 |
| -------- | ------------- | ---------------------- | ------- | -------------------------- |
| Men      | Men           | 7                      | 11      | —                          |
| Women    | Women         | 7                      | 11      | —                          |
| Mixed    | Men and women | 8                      | 12      | At least 4 men and 4 women |

A runner can be in **one team of their own sex category and one mixed team** at the same time. Not two men's teams, not two mixed teams.

## Step 1 · Someone creates the team

Any signed-in runner with a complete profile who is 18 or older can create a team. The creator becomes the manager and is the first member. Creating a team is charged once, to the creator; during the launch window the charge is nil.

1. **Platform** checks the runner may create a team at all — signed in, email verified, profile complete, 18 or older — **before** any checkout is opened. Nobody is sent to a checkout they would be refused after.
2. **Runner** fills in the form: team name, region, category, and a short description. Team names must be unique; a taken name is refused on the form.
3. **Runner** answers one question: _"Do you already have all your teammates, or are you looking for runners?"_
4. **Runner** presses **Create team** and arrives at checkout. It shows one line — _Team creation_ — the normal fee struck through, the launch offer applied, and **0.00 to pay**. No card is asked for, because there is nothing to charge.
5. **Runner** confirms.
6. **Platform** creates the team the moment the checkout settles. The creator is now **Manager** and the first member, and receives a team code and a share link. The confirmation email names the fee, the offer, and that nothing was charged.
7. **Platform** lists the team on the public **Teams** page if the manager said "looking for runners", so others can find it. The manager can switch this on or off at any time.

There is still **no approval step**: the platform decides, not the organiser. What changed is only that "immediately" now means "as soon as the checkout settles", which for a nil amount is the next screen.

**Why go through a checkout for nothing.** The charge is coming, and the flow that carries it should be the flow people already use. Running the real checkout at 0.00 means the day the offer ends nothing changes for the runner but the number: same screens, same order, same emails, same webhook. It also means the fee is visible from the first day, so the price is never a surprise announcement.

### The team exists only once checkout settles

The form's answers are held while the runner is in checkout and are written as a team when it settles. Until then nothing exists.

| What happens                                   | What the runner sees                                             | What is left behind                           |
| ---------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------- |
| Checkout settles                               | The team page, with the code and share link                      | The team, one manager membership              |
| Runner cancels or closes the tab               | Back on the team form, answers still filled in                   | Nothing. The name stays free for anyone       |
| Runner never returns                           | —                                                                | Nothing. The held answers expire on their own |
| The name was taken while they were in checkout | "That name has just been taken — pick another", back on the form | Nothing, and nothing was charged              |

The name is checked on the form **and** again when the checkout settles, because two people can be in checkout for the same name at once. At 0.00 the loser simply picks another name. Once there is a real fee this is no longer good enough: a paid creation needs either a short hold on the name or a refund path. Flagged here rather than solved, because it is a decision for the release that starts charging.

## The launch coupon

- **Free until a date.** One value in config holds the end of the launch window. Every team created before it is free; teams created after it pay.
- **Applied by the platform, never typed.** There is no code to share, leak, or forget. The runner does not enter anything, and there is nothing to hand around to people the offer was not meant for.
- **The price shown is the price paid.** The window is read when the checkout is opened and honoured for that session, so an offer that lapses mid-checkout does not change the amount under the runner.
- **Once, on creation.** Not a subscription, not per member, not per race. Joining a team, being invited, and accepting are free for everyone, always.
- **Teams created free stay free.** The end of the window does not reach back. Dissolving a team refunds nothing and re-creating one pays whatever price applies then.
- **The amount is not decided yet.** It lives in one config constant next to the window date, so setting it is one edit and no migration.

When the window closes, the flow above is unchanged except that step 4 shows a real amount and asks for a card, and step 6 waits for the payment to clear.

## Step 2 · Runners come in through one of two doors

Both doors end the same way: the manager decides, and the platform checks the rules. A person is never added to a team without the manager's say and their own. Neither door involves a payment.

### Door A · Invitation (the manager reaches out)

1. **Manager** types a runner's email on the team page and presses **Invite**. The organiser can do the same on the team's behalf.
2. **Platform** sends an email with a personal link. The link works once and expires after 30 days. The manager can resend or cancel it.
3. **Runner** opens the link.

- _Already has an account:_ sees the team and presses **Accept** or **Decline**.
- _No account yet:_ is asked to sign up with the email pre-filled, confirms their email, completes their profile, and lands back on the same Accept screen.

4. **Platform** checks the rules (below). If they pass, the runner is a member. The manager gets an email.

### Door B · Ask to join (the runner reaches out)

1. **Runner** either enters a **team code** the manager shared, or finds the team on the public **Teams** page and presses **Ask to join**. Must be signed in with a complete profile.
2. **Platform** checks the rules first. If the runner is not eligible (wrong category, team full, already in a team of that category), it says so right away and no request is made.
3. **Manager** sees the request in a queue on the team page and gets an email. Presses **Accept** or **Decline**.
4. **Platform** re-checks the rules at the moment of acceptance, adds the member, and emails the runner the decision.

> The team code only lets someone _ask_. Knowing the code never puts anyone on the team. The manager can change the code at any time if it leaks; requests already made are not affected.

## Rules the platform enforces automatically

- The runner's sex matches the category. Men's teams take men, women's teams take women, mixed teams take both.
- The team is below its maximum (11, or 12 for mixed).
- On a mixed team, there is still room for at least 4 of each sex. In practice: never more than 8 men or 8 women.
- The runner is not already in another team of the same category.
- The runner is 18 or older and has a complete profile (name, date of birth, sex, phone).
- Open invitations never exceed empty seats, so a full team cannot build a waiting list.
- Team creation is checked for eligibility **before** checkout and the name re-checked **at** settlement.
- The launch discount is decided by the platform from the window date. A runner can neither claim it early nor extend it.

"Complete" means the team has reached its minimum. It is shown on the team page as, for example, "7 of 7 — complete" or "5 of 8 — 3 more needed". Nobody has to press anything to become complete.

## Changes after joining

| Action                                                           | Who     | What happens                                                                                                                                                    |
| ---------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Leave the team                                                   | Runner  | One click with confirmation. The runner may be invited or ask again later.                                                                                      |
| Remove a member                                                  | Manager | The member is taken off the roster and emailed.                                                                                                                 |
| Hand over management                                             | Manager | Another member becomes manager; the old manager stays as a member. The new manager is emailed. The creation fee does not follow the role and is not re-charged. |
| Manager leaves                                                   | Manager | Not allowed while others remain. Hand over first, then leave.                                                                                                   |
| Dissolve the team                                                | Manager | The team is deleted, every member is emailed, open invitations and requests are cancelled. Nothing is refunded.                                                 |
| Rename, edit region or description, switch "looking for runners" | Manager | Immediate, and free. The team's web address does not change on rename.                                                                                          |

The organiser (admin) can do all of the above on any team, and can invite a runner to a team on the manager's behalf. An organiser creating a team on someone's behalf does not go through checkout.

## What people see

- **Everyone** can see the public Teams page and any team's card: name, region, category, how many runners it has, its description, and the manager's first name.
- **Members** also see the full roster with names, the team code, and the share link.
- **The manager** also sees the invitation list, the request queue, and the management buttons.
- **Runners** see their own teams, pending invitations, and pending requests on their profile.
- Roster names are never shown publicly at this stage.
- Money is only ever shown to someone **creating** a team. There is no price on a team card, no billing section on the team page, and members are never shown what the team cost.

## Notes for the build

Four things about the nil-amount checkout that are easy to get wrong and cheap to get right:

- **A fully discounted session does not report itself as paid.** Stripe settles a 0.00 session with `payment_status: "no_payment_required"`, not `"paid"`. The existing webhook promotes only on `"paid"` (`src/app/api/stripe/webhook/route.ts`), so a team creation handled by that branch would silently never be created. Team sessions must be recognised by their own `metadata.kind` and accept both statuses — the same way the ACER top-up branch owns its sessions.
- **Holding the form answers is a solved problem here.** `pending_registrations` exists precisely as the intake seam for a paid flow and is retained on purpose (ADR 0001). Team creation is its second tenant, not a reason for a new mechanism, and not a reason to re-add a slot counter.
- **The webhook is the writer; the success page is not.** The team must be created by the settlement handler and merely displayed by the success page, so a runner who closes the tab still gets their team, and a Stripe retry finds it already there rather than creating a second one. Keying on the session id makes the retry harmless.
- **The window and the fee are one config module**, read on the server when the session is created. Nothing about the offer is computed in the browser, and no environment flag decides whether the discount exists.
