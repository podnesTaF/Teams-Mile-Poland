/**
 * The sentinels a money path throws from **inside** a transaction.
 *
 * Thrown rather than returned because each refusal has to abort a transaction
 * that may already have written something (a team row, the first leg of a
 * transfer); the server action catches them beside its 23505 mappings and turns
 * them back into ordinary `teamFailure(...)` refusals, so the caller still sees
 * a plain result and never an exception. Nothing user-facing reads the
 * messages — they are for logs.
 *
 * Every `is*` predicate walks `cause`: Drizzle re-throws what the transaction
 * callback threw, but it already wraps *query* errors in `DrizzleQueryError`,
 * and a future wrapper around the callback would hide an `instanceof` one level
 * down. The failure mode of missing that is a 500 in place of a refusal.
 */

function findInChain<T>(error: unknown, matches: (e: unknown) => e is T): T | null {
  for (let e: unknown = error; e; e = (e as { cause?: unknown }).cause) {
    if (matches(e)) return e;
    if (typeof e !== "object") return null;
  }
  return null;
}

/** The payer's balance was short, read under the payer's lock. */
export class InsufficientAcerError extends Error {
  constructor(
    readonly requiredMinor: number,
    readonly balanceMinor: number,
  ) {
    super(`Needs ${requiredMinor} minor ACER; balance is ${balanceMinor}.`);
    this.name = "InsufficientAcerError";
  }
}

export function isInsufficientAcer(error: unknown): boolean {
  return (
    findInChain(error, (e): e is InsufficientAcerError => e instanceof InsufficientAcerError) !==
    null
  );
}

/**
 * The same `transferId` was already used for a transfer with a different
 * amount, kind or owner — a stale form re-submitted after its fields changed.
 * The recorded transfer is left alone; the caller asks the person to try again
 * with a fresh form.
 */
export class StaleTransferError extends Error {
  constructor(readonly transferId: string) {
    super(`Transfer ${transferId} is already recorded with different terms.`);
    this.name = "StaleTransferError";
  }
}

export function isStaleTransfer(error: unknown): boolean {
  return (
    findInChain(error, (e): e is StaleTransferError => e instanceof StaleTransferError) !== null
  );
}

/**
 * The payer or the payee no longer exists — a team dissolved or an account
 * deleted between the page render and the press. Read under lock, so it is the
 * truth at commit time, not a stale pre-check.
 */
export class WalletOwnerNotFoundError extends Error {
  constructor(readonly side: "from" | "to") {
    super(`The ${side === "from" ? "payer" : "payee"} does not exist.`);
    this.name = "WalletOwnerNotFoundError";
  }
}

export function isWalletOwnerNotFound(error: unknown): boolean {
  return (
    findInChain(
      error,
      (e): e is WalletOwnerNotFoundError => e instanceof WalletOwnerNotFoundError,
    ) !== null
  );
}

/**
 * A transfer's own precondition failed — the roster check a payout supplies
 * through `transferAcer`'s `assert` hook. Carries a code the action maps to a
 * refusal reason, so the wallet module never has to know what a roster is.
 */
export class TransferAssertionError extends Error {
  constructor(readonly code: string) {
    super(`Transfer refused: ${code}.`);
    this.name = "TransferAssertionError";
  }
}

export function transferAssertionCode(error: unknown): string | null {
  return (
    findInChain(error, (e): e is TransferAssertionError => e instanceof TransferAssertionError)
      ?.code ?? null
  );
}
