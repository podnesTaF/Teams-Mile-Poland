---
name: implement
description: Implement a piece of work based on a PRD or a single GitHub issue. Run one issue per fresh session.
disable-model-invocation: true
---

Implement the work described in the PRD or issue. You are the hands, not the head — the deciding was done upstream; do not re-litigate scope.

1. Fetch the issue (and its parent PRD, if referenced) with `gh issue view <n> --comments` (see `docs/agents/issue-tracker.md`). Read the PRD's **Contracts** section — it is frozen; if the code you find makes a contract untenable, stop and surface it rather than silently deviating.

2. Work in the areas the issue names. Honor `docs/agents/cross-cutting-checklist.md` throughout — most-missed items are trilingual i18n (pl/en/ua for every new public string; admin English-only), the auth gate chain with `redirectTo` threaded, additive-only migrations keyed by `event_slug` with legacy tables frozen, and the modal+fallback pattern. Reuse the existing idioms the checklist lists before adding new ones.

3. Verify continuously — there is no test runner in this repo:
   - `npm run typecheck` regularly as you go.
   - `npm run build` before finishing (also validates routes/SSG). If you deleted or renamed a route, clear `.next` first — the stale types validator will fail otherwise.
   - `npm run lint` — introduce no new errors (the pre-existing `admin/page.tsx` static-export `<a>` warnings are acceptable).
   - DB-dependent work (migrations, auth/registration round-trip) needs a Neon branch — call it out if you can't run it locally.

4. Once done, use `/code-review` to review the work and `/verify` to drive it end-to-end.

5. Commit to the current branch, referencing the issue (`#<n>`) in the message. Then comment on the issue (`gh issue comment`) with the commit SHA(s) and what shipped, tick the acceptance-criteria checkboxes that are met (edit the body), and close the issue only when all are ticked. Do not touch the parent PRD issue.

6. If the work advances the mile-series effort, add a dated progress line to the relevant `planning/*.md` doc (matching the existing phase-log style) so the next session has continuity.
