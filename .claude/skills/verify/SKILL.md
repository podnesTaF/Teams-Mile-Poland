---
name: verify
description: Drive a slice end-to-end in this repo — the static gate (typecheck/build/lint), the real app over HTTP in all three locales, and a database round-trip through the actual data layer — then report PASS/FAIL/SKIPPED per step. Use when the user wants to verify a change, check a slice works, or asks whether something actually runs.
---

# Verify

There is **no test runner in this repo** and none is to be introduced. Verification means running the real thing: the compiler, the build, the app over HTTP, and the data layer against a real Postgres. This skill drives that and reports honestly.

A step you did not run is **SKIPPED with a reason**, never an inferred pass.

## Process

### 1. Build the verification script

The issue or PRD is the script — don't invent one.

- Fetch the issue with `gh issue view <n> --json number,title,body,comments` (write to a file and read it; piped `gh issue view` prints nothing here). Fetch the parent PRD too.
- A PRD's **Verification** section is an ordered walkthrough — use it verbatim. Otherwise derive steps from the issue's acceptance criteria.

Enumerate the steps *before* running anything, so the final report can account for every one. Tracker conventions: `docs/agents/issue-tracker.md`.

### 2. Static gate

```bash
npm run typecheck   # tsc --noEmit
npm run build       # next build — also validates routes/SSG
npm run lint        # eslint
```

- **Clear `.next` first** if any route was added, renamed or deleted — and also if `typecheck` reports `Cannot find module '../../src/app/…/page.js'`, which means the stale types validator is referencing routes from another worktree.
- Lint has a **pre-existing baseline** (including static-export `<a>` warnings and `react-hooks/set-state-in-effect` errors), and a full-repo run also sweeps `.claude/worktrees`, so the totals are noise. Check your own work instead: `npx eslint <changed files>` must be silent.

### 3. Drive the app

Start it — `npm run dev` — and exercise the real routes. Prefer the `/run` skill if it fits; otherwise drive HTTP directly.

- **Public surfaces in all three locales** (`/pl/…`, `/en/…`, `/ua/…`). A missing message key renders as an error or the raw key — this is how the trilingual requirement is actually checked. To confirm a key exists in all three catalogs, read `src/messages/{pl,en,ua}.json` with the **Read tool** — PowerShell's `Get-Content`/`Set-Content` mis-decodes UTF-8 and will corrupt Polish and Ukrainian text if you write the file back.
- **Admin surfaces** under `/admin/*`: confirm an unauthenticated request redirects and streams **no data**. English-only is correct there.
- **The gate chain** for user-gated flows: guest → sign-up → verify-email → profile → action, with `redirectTo` surviving every hop.
- **Flow states, not just the happy path**: signed-out, empty, error, and the event-lifecycle state the surface is supposed to render.

### 4. Database round-trip

Migrations and data-layer behaviour need a real Postgres.

**Before touching any database**, establish which one `DATABASE_URL` points at and say so. A **Neon branch is the default**; there is no `neonctl` in this environment, so ask the user for a branch URL. Applying a migration to the live database, or writing rows to it, is the owner's call and requires explicit sign-off in the conversation — never assume it from a previous session's precedent.

Once cleared, drive the **real data-layer functions** (not hand-written SQL that reimplements them) through a throwaway fixture:

<fixture-pattern>

1. Pick a scope with no real data — e.g. an event slug with zero registrations — and **assert that first**, aborting if it isn't empty.
2. Assert the schema shape directly: `pg_indexes` for the index predicate, `pg_enum` for enum values and order, `information_schema.columns` for new columns, and that frozen legacy tables were not touched.
3. Create fixtures, then call the exported data-layer functions and assert on what they return.
4. Delete every fixture in a `finally` block, then assert both that nothing was left behind and that the real rows are unchanged.
5. Print `PASS`/`FAIL` per check and exit non-zero on any failure.

Put the script in `scripts/`, run it with `npx tsx scripts/<name>.ts` from the project root so the `@/` alias resolves, and **delete it when done** — it is a one-off, not a test suite. Wrap the body in an `async main()`: tsx compiles to CJS here and top-level `await` fails.

</fixture-pattern>

### 5. Report

One line per step from the enumerated list: **PASS**, **FAIL** (with the actual output quoted, not paraphrased), or **SKIPPED** (with why, and what it would take).

Then:

- What you changed to make a step pass, if anything.
- Anything you could not verify, stated plainly. If a step is blocked, finish every other step first rather than stopping.
- If a failure traces to the PRD's frozen **Contracts** rather than the implementation, surface it as a contract problem instead of quietly working around it.

Do not commit, close issues, or edit issue bodies from this skill — that belongs to `/implement`. If findings need reviewing rather than running, use `/code-review`.
