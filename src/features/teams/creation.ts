import { customAlphabet } from "nanoid";
import { eq } from "drizzle-orm";

import { users } from "@/db/schema/auth";
import { userTeamMembers, userTeams } from "@/db/schema/user-teams";
import { slugify } from "@/features/admin/news-slug";
import { getAcerBalance, recordWalletTransaction } from "@/features/wallet/data";
import { getDb } from "@/lib/db";

import { TEAM_CODE_ALPHABET, TEAM_CODE_LENGTH, type TeamCategory } from "./config";

/**
 * Founding a team: the identifiers it needs and the one transaction that pays
 * for it and writes it.
 *
 * The split mirrors `entries.ts` / `actions/entries.ts` — **everything here is
 * already past the gate**. `actions/team.ts` runs `requireTeamActor`, zod,
 * eligibility and the name pre-check, then calls {@link createTeamRows}. The
 * reason for the split is the same as #67's: a transaction body that a
 * verification script can drive without forging a session, which for a money
 * path is the difference between verifying the ledger arithmetic and verifying
 * a screenshot.
 *
 * Not a `"use server"` module: it exports plain functions, none of which is a
 * server action, and a script may import it directly.
 */

const newCode = customAlphabet(TEAM_CODE_ALPHABET, TEAM_CODE_LENGTH);

/**
 * Postgres unique-violation, optionally a named one.
 *
 * The `cause` walk is what makes it work at all: Drizzle wraps a failed query
 * in a `DrizzleQueryError` whose own `code` is undefined, so reading the code
 * off the top-level error silently never matches and a `name_taken` race comes
 * back as a 500 instead of a refusal. (`creditAcerPurchase` walks the chain for
 * exactly the same reason; this function did not, and a round trip against the
 * live database is where that showed.)
 */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  for (let e: unknown = error; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    const err = e as {
      code?: string;
      constraint_name?: string;
      constraint?: string;
      message?: string;
    };
    if (err.code !== "23505") continue;
    if (!constraint) return true;
    // The constraint's name arrives as `constraint_name` from postgres.js and
    // as `constraint` from node-postgres; the message carries it either way.
    const detail = `${err.constraint_name ?? ""} ${err.constraint ?? ""} ${err.message ?? ""}`;
    return detail.includes(constraint);
  }
  return false;
}

/**
 * A slug is generated once from the name and never rewritten, so collisions are
 * resolved here rather than by re-slugging later: `warsaw-aces`, then
 * `warsaw-aces-2`, `warsaw-aces-3`. Names are unique case-insensitively, so a
 * collision only happens when two different names slugify the same way
 * ("Warsaw Aces" vs "Warsaw  Aces!").
 */
export async function uniqueSlug(name: string): Promise<string> {
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
export async function uniqueCode(): Promise<string> {
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
 * The creator's wallet was short **inside** the transaction, after the lock.
 *
 * Thrown rather than returned because the refusal has to abort a transaction
 * that has already inserted the team row; the action catches it beside the
 * 23505 mappings and turns it back into `teamFailure("insufficient_balance")`,
 * so the caller still sees a plain refusal and never an exception.
 */
export class InsufficientAcerError extends Error {
  constructor(
    readonly requiredMinor: number,
    readonly balanceMinor: number,
  ) {
    super(`Team creation needs ${requiredMinor} minor ACER; balance is ${balanceMinor}.`);
    this.name = "InsufficientAcerError";
  }
}

/**
 * Whether this is the shortfall sentinel.
 *
 * The `cause` walk is not defensive padding: Drizzle re-throws what the
 * transaction callback threw, but a future wrapper (it already wraps *query*
 * errors in `DrizzleQueryError`) would hide an `instanceof` check behind one
 * level, and the failure mode of missing it is a 500 in place of a refusal.
 */
export function isInsufficientAcer(error: unknown): boolean {
  for (let e: unknown = error; e; e = (e as { cause?: unknown }).cause) {
    if (e instanceof InsufficientAcerError) return true;
    if (typeof e !== "object") return false;
  }
  return false;
}

export type CreateTeamRowsInput = {
  /** The creator. Becomes the manager, the first member, and pays the fee. */
  userId: string;
  name: string;
  region: string;
  category: TeamCategory;
  recruiting: boolean;
  /** Empty string and `null` both mean "no description". */
  description?: string | null;
  /**
   * What the creator is charged, in ACER minor units, as a **positive** number;
   * the ledger row carries the minus. `0` skips the debit entirely rather than
   * writing a zero-amount row. Passed in rather than read from the config here
   * so the action decides the price once — the same number it pre-checked the
   * balance against.
   */
  priceMinor: number;
};

export type CreatedTeam = { teamId: string; slug: string; code: string };

/**
 * Create a team and pay for it, in one transaction.
 *
 * Team row, ledger debit and manager membership land together or not at all: a
 * team with no manager on its roster would be unreachable and uncountable, and
 * a debit for a team that a unique violation rolled back would be money taken
 * for nothing. That is also why the name and category refusals are left as
 * 23505s to the caller — inside one transaction they undo the payment for free.
 *
 * **The balance race.** There is no stored balance to `UPDATE … WHERE balance
 * >= price`, so two creates by one person (a double-click, two tabs) could each
 * read the same `SUM` and both pass. The `select … for update` on the creator's
 * `users` row is the per-user mutex — the same idiom the invitation and
 * join-request accepts use on the team row — and the balance is re-read *under*
 * it through {@link getAcerBalance}`(userId, tx)`. The second caller therefore
 * waits, re-reads a balance that now includes the first debit, and throws
 * {@link InsufficientAcerError}. The action's pre-check outside the transaction
 * is a courtesy that makes the everyday case a message instead of a rollback;
 * this is what makes it true.
 */
export async function createTeamRows(input: CreateTeamRowsInput): Promise<CreatedTeam> {
  const { userId, name, region, category, recruiting, description, priceMinor } = input;

  const slug = await uniqueSlug(name);
  const code = await uniqueCode();
  const db = getDb();

  const teamId = await db.transaction(async (tx) => {
    if (priceMinor > 0) {
      // The lock, not the read, is what serialises two spends; the row is
      // selected only to take it.
      await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");

      const balanceMinor = await getAcerBalance(userId, tx);
      if (balanceMinor < priceMinor) throw new InsufficientAcerError(priceMinor, balanceMinor);
    }

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
        managerUserId: userId,
      })
      .returning({ id: userTeams.id });

    if (priceMinor > 0) {
      // Keyed by the team so a retry of this exact creation could never charge
      // twice; the id is minted in this transaction, so the key is unique by
      // construction and the write is a plain insert in practice.
      await recordWalletTransaction(
        {
          userId,
          asset: "ACER",
          amountMinor: -priceMinor,
          kind: "team_creation",
          reference: `team:${slug}`,
          idempotencyKey: `team_creation:${team.id}`,
        },
        tx,
      );
    }

    await tx.insert(userTeamMembers).values({
      teamId: team.id,
      userId,
      role: "manager",
      category,
    });

    return team.id;
  });

  return { teamId, slug, code };
}
