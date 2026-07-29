/**
 * Throwaway DB round-trip for the publish + heat_assignment delta (#30).
 * NOT committed — delete when done.
 *
 *   npx tsx --env-file=.env.local scripts/verify-heat-publish.ts
 *   npx tsx --env-file=.env.local scripts/verify-heat-publish.ts --teardown
 *
 * This file is a loader and nothing else. It blanks `RESEND_API_KEY` and then
 * pulls the real script in with a **dynamic** import, because a static `import`
 * is hoisted above any assignment in the module body — which is exactly how an
 * earlier version of this script evaluated `src/lib/email` with the real key and
 * actually sent mail. With the key blank, `resend` is `null` and there is no
 * transport to send through; the impl asserts that before it touches anything.
 */
process.env.RESEND_API_KEY = "";
delete process.env.RESEND_API_KEY;

void import("./verify-heat-publish.impl").catch((e) => {
  console.error(e);
  process.exit(1);
});
