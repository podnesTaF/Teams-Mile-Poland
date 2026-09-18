import { and, eq } from "drizzle-orm";

import type { UserTeamRow } from "@/db/schema/user-teams";
import { userTeamMembers } from "@/db/schema/user-teams";
import { TransferAssertionError } from "@/features/wallet/errors";
import { transferAcer, type TransferAcerOutcome } from "@/features/wallet/transfers";

/**
 * The team's treasury (ADR 0012): a member pays in, the manager pays out.
 *
 * Thin on purpose — the locks, the replay check and the two-leg write live in
 * `src/features/wallet/transfers.ts`; this module only knows which owner is
 * which, what each leg's history line should point at, and the one team rule
 * the wallet must not have to know: a payout goes to someone **on the roster
 * at commit time**. Like `creation.ts` and `entries.ts`, everything here is
 * already past the gate (`actions/treasury.ts` runs the guards and zod) and a
 * verification script may import it directly.
 */

export type TreasuryMoveInput = {
  team: UserTeamRow;
  /** Positive integer minor units. */
  amountMinor: number;
  /** The person pressing the button. */
  actorUserId: string;
  /** Client-minted uuid, one per form render. */
  transferId: string;
};

/**
 * A member's contribution: their wallet leg points at the team, the treasury
 * leg points at them. `created_by` is the member on both legs — the history
 * then answers "who paid this in" without a memo nobody can translate.
 */
export function contributeRows({
  team,
  amountMinor,
  actorUserId,
  transferId,
}: TreasuryMoveInput): Promise<TransferAcerOutcome> {
  return transferAcer({
    from: { userId: actorUserId },
    to: { teamId: team.id },
    amountMinor,
    kind: "treasury_contribution",
    actorUserId,
    transferId,
    reference: { out: `team:${team.slug}`, in: `user:${actorUserId}` },
  });
}

/**
 * The manager's payout to `memberUserId`.
 *
 * The roster check runs **inside** the transfer's transaction, after the locks,
 * and takes the seat row `FOR KEY SHARE`: a concurrent leave or removal then
 * waits until this payout commits, so the invariant is "the payee was a member
 * when the money moved", not "was a member when the page rendered". A payee
 * who has already left is refused as `not_a_member`.
 */
export function payoutRows({
  team,
  memberUserId,
  amountMinor,
  actorUserId,
  transferId,
}: TreasuryMoveInput & { memberUserId: string }): Promise<TransferAcerOutcome> {
  return transferAcer({
    from: { teamId: team.id },
    to: { userId: memberUserId },
    amountMinor,
    kind: "treasury_payout",
    actorUserId,
    transferId,
    reference: { out: `user:${memberUserId}`, in: `team:${team.slug}` },
    assert: async (tx) => {
      const [seat] = await tx
        .select({ id: userTeamMembers.id })
        .from(userTeamMembers)
        .where(and(eq(userTeamMembers.teamId, team.id), eq(userTeamMembers.userId, memberUserId)))
        .for("key share");
      if (!seat) throw new TransferAssertionError("not_a_member");
    },
  });
}
