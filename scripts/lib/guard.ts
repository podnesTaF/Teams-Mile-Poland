/**
 * The one gate between a fixture script and the live database.
 *
 * The verify/seed scripts in `scripts/` write straight to the tables — users,
 * registrations, heats, results — bypassing every guard the action layer
 * applies. There is no branch DB here, so `DATABASE_URL` is production, and a
 * script run by reflex ("just checking the slice") leaves real debris behind:
 * a fixture session once left 8 fake registrations and 9 draft heats on
 * `mile-2026-08-29`. Teardown modes are the same risk class — they delete.
 *
 * So: nothing runs unless the operator says `ALLOW_FIXTURES=1` out loud, and
 * whoever does say it is shown the host they are about to write to first.
 *
 *   ALLOW_FIXTURES=1 npx tsx --env-file=.env.local scripts/<name>.ts
 *
 * Dependency-free on purpose — it must be safe to call as the first statement
 * of a script, above anything that could open a connection.
 */

/** The host `DATABASE_URL` points at, or a reason it cannot be read. */
function databaseHost(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return "DATABASE_URL is not set";
  try {
    const { hostname, pathname } = new URL(url);
    const database = pathname.replace(/^\//, "");
    return database ? `${hostname}/${database}` : hostname;
  } catch {
    return "DATABASE_URL is set but unparseable";
  }
}

/**
 * Refuse to continue unless `ALLOW_FIXTURES=1` is set; otherwise announce the
 * target host and return. Call before the first DB read or write.
 *
 * @param scriptName how the script names itself in the refusal, e.g.
 *   `scripts/seed-heats-fixture.ts`.
 */
export function requireFixtureConsent(scriptName: string): void {
  const teardown = process.argv.includes("--teardown");
  const mode = teardown ? "teardown (deletes rows)" : "fixture write";

  if (process.env.ALLOW_FIXTURES !== "1") {
    console.error(`REFUSING TO RUN: ${scriptName} writes fixture data to a real database.`);
    console.error(`  target:  ${databaseHost()}`);
    console.error(`  mode:    ${mode}`);
    console.error("  There is no branch DB — DATABASE_URL is the live one.");
    console.error(
      `  Re-run with ALLOW_FIXTURES=1 if that is what you want:\n` +
        `    ALLOW_FIXTURES=1 npx tsx --env-file=.env.local ${scriptName}` +
        `${teardown ? " --teardown" : ""}`,
    );
    process.exit(1);
  }

  console.log(`ALLOW_FIXTURES=1 — ${mode} against ${databaseHost()}`);
}
