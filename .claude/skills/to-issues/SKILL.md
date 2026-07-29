---
name: to-issues
description: Break a plan, spec, or PRD into independently-grabbable GitHub issues using tracer-bullet vertical slices.
disable-model-invocation: true
---

# To Issues

Break a plan into independently-grabbable issues using vertical slices (tracer bullets).

Tracker conventions live in `docs/agents/issue-tracker.md`.

## Process

### 1. Gather context

Work from whatever is already in the conversation context. If the user passes an issue reference (number or URL), fetch it with `gh issue view <n> --comments` and read its full body and comments.

### 2. Explore the codebase (optional)

If you have not already explored the relevant code, do so. Issue titles/descriptions should use the glossary vocabulary from `CONTEXT.md` (if it exists), and respect ADRs in `docs/adr/` for the area you're touching.

Look for opportunities to prefactor to make the implementation easier. "Make the change easy, then make the easy change."

### 3. Draft vertical slices

Break the plan into **tracer bullet** issues. Each issue is a thin vertical slice that cuts through every layer it needs end-to-end, NOT a horizontal slice of one layer.

<vertical-slice-rules>

- Each slice delivers a narrow but COMPLETE path through the layers it touches: registry/config → schema/migration → server action → route/page (+ modal) → i18n (pl/en/ua) → verification.
- A completed slice is demoable or `/verify`-able on its own.
- Any prefactoring is its own first slice.
- This is one app, so slices are scoped by **area** (events / auth / registration / admin / emails / db / landing / i18n), not by separate codebases. A slice usually spans a few areas end-to-end (e.g. `db` + `registration` + `i18n`). Keep it to the narrowest complete path — "the whole feature across every area" is almost always too coarse.
- The PRD's frozen **Contracts** section is what lets later slices (e.g. the admin view of a thing the registrant slice created) proceed independently — they consume the shipped contract.

</vertical-slice-rules>

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each slice show:

- **Title**: short descriptive name
- **Areas**: which areas it touches
- **Blocked by**: which other slices (if any) must complete first
- **User stories covered**: which user stories this addresses (if the source has them)

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the dependency relationships correct?
- Should any slices be merged or split further?

Iterate until the user approves.

### 5. Publish the issues

For each approved slice, publish a GitHub issue (`gh issue create`, `--body-file`) using the template below, labelled `ready-for-agent` plus its area labels, unless instructed otherwise. Publish in dependency order (blockers first) so you can reference real issue numbers in "Blocked by".

<issue-template>
## Parent

Reference to the parent PRD issue (`#<n>`), if any — otherwise omit.

## What to build

A concise description of this vertical slice. Describe the end-to-end behavior, not layer-by-layer implementation. Name the relevant part of the parent PRD's Contracts section rather than restating it.

Avoid file paths or code snippets — they go stale. Exception: a prototype snippet that encodes a decision more precisely than prose (state machine, zod schema, table shape) may be inlined, noted as from a prototype.

## Areas

The areas this slice touches (events / auth / registration / admin / emails / db / landing / i18n).

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

Include the applicable cross-cutting items as criteria — trilingual i18n for any new strings, the gated/error/empty/lifecycle states, additive migration reviewed, `/verify` passes, no new lint errors. A slice isn't done with only its happy path.

## Blocked by

- Reference to the blocking issue (`#<n>`), or "None - can start immediately".

</issue-template>

Do NOT close or modify the parent PRD issue.
