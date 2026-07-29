---
name: to-prd
description: Turn the current conversation into a PRD with frozen contracts and publish it as a GitHub issue — no interview, just synthesis of what you've already discussed.
disable-model-invocation: true
---

This skill takes the current conversation context and codebase understanding and produces a PRD. Do NOT interview the user — just synthesize what you already know.

Tracker conventions live in `docs/agents/issue-tracker.md`. Read `docs/agents/cross-cutting-checklist.md` before writing — the Cross-Cutting Decisions and Contracts sections below depend on it.

## Process

1. Explore the relevant code to understand the current state, if you haven't already. Use the glossary vocabulary from `CONTEXT.md` (if it exists) throughout the PRD, and respect any ADRs in `docs/adr/` for the area you're touching.

2. **Freeze the contracts.** A feature here usually threads config → DB → server action → route/UI → i18n in one app; the expensive failure mode is drift between the registry, the schema, and the UI's assumptions. Sketch, at the level of names and shapes (not file paths):
   - **Registry/config** — new or changed fields on the event config (`registry.ts` / `types.ts` shapes: eventType, status, timeRange, timetable, …)
   - **DB schema** — Drizzle tables/columns/enums/indexes keyed by `event_slug`, and the additive migration they imply. Legacy team tables stay frozen.
   - **Server actions** — signatures: input (zod shape) → result, plus the guards they enforce (auth → verify → profile → open, admin).
   - **Routes** — page routes, `@modal/(.)` intercepts, and API/cron routes with method + auth (CRON_SECRET / admin / user / public).
   - **Client islands** — any client component that fetches an API route, and the state shape it holds.
   - **i18n** — which namespaces/keys are added, across pl/en/ua (admin English-only).

   Also sketch **how the feature will be verified** end-to-end (which flow `/verify` drives). There is no test infra — typecheck + build + lint + `/verify` carry the load.

   **Check with the user that the contracts and verification approach match their expectations. This is the gate — do not write the PRD until they confirm.**

3. Write the PRD using the template below, then publish it as a GitHub issue (`gh issue create`) with the `prd` and `ready-for-agent` labels plus the area labels it touches (see `issue-tracker.md`). Write the body to a scratchpad file and use `--body-file`.

<prd-template>

## Problem Statement

The problem that the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## User Stories

A LONG, numbered list of user stories, in the format:

1. As a <actor>, I want a <feature>, so that <benefit>

Actors: **guest** (unauthenticated visitor), **registrant** (signed-in runner), **admin/staff**.

This list should be extensive and cover all aspects of the feature — happy path, gated paths, error/empty states, and each relevant event-lifecycle state.

## Contracts

The frozen registry/config shapes, DB schema + migration, server-action signatures, routes, client-island state, and i18n namespaces from step 2 — the version the user confirmed. Type shapes and signatures are welcome; file paths are not.

## Cross-Cutting Decisions

Walk `docs/agents/cross-cutting-checklist.md` and record a decision for every item that applies: trilingual i18n (which namespaces), auth gating (public/user/admin + redirectTo chain), flow states, SSG/migration constraints, modal+fallback, reuse targets, emails, admin English-only, leanness. Items that don't apply get an explicit "n/a".

## Implementation Decisions

Modules built/modified and their interfaces, technical clarifications, architectural decisions. No file paths or code snippets — they go stale fast.

Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, zod schema, table shape), inline it within the relevant decision and note it came from a prototype. Trim to the decision-rich parts.

## Verification

How the feature is verified: which end-to-end flow `/verify` drives, plus the standard `npm run typecheck` / `npm run build` / `npm run lint` gate. Note any DB-dependent steps that need a Neon branch (migrations, auth/registration round-trip). There is no test runner in this repo — do not propose one.

## Out of Scope

Anything that doesn't trace to the Problem Statement. Apply the leanness rule.

## Further Notes

Any further notes about the feature.

</prd-template>
