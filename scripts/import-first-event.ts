/**
 * One-time first-event import (issue #9, PRD #7).
 *
 * Creates unverified `users` accounts from the frozen legacy `runners` table
 * (read-only) and one `legacy_participations` row per person for warsaw-2026,
 * with `attended` derived from the official results config corroborated by
 * legacy check-in timestamps.
 *
 * Dry-run by default — prints the full match report and writes nothing.
 * Pass `--write` to perform the import (run against a Neon branch first).
 *
 *   npm run import:first-event            # dry-run
 *   npm run import:first-event -- --write
 *
 * Frozen collision rules (PRD #7):
 * - existing user email → attach participation only, never touch profile fields
 * - duplicate emails among runners → one user; attended if any row attended;
 *   name/phone/locale/team from the first row (by created_at)
 * - ambiguous / zero name matches → manual-resolution list, never guessed
 * - results entries with no runner row → reported, not imported
 * - imported profiles carry name/phone/locale only — unverified, no password,
 *   deliberately profile-incomplete so the existing profile gate fires before
 *   any registration
 *
 * Idempotent: by email for users, by (event_slug, user_id) for participations;
 * re-running `--write` upserts only the attended flag (e.g. after a results
 * fix) and never duplicates rows. Not safe to run concurrently with itself —
 * a second writer aborts loudly on the users unique(email) constraint.
 */
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { nanoid } from "nanoid";
import postgres from "postgres";

import { legacyParticipations, runners, teams, users } from "../src/db/schema";
import { nameKey } from "../src/lib/events/name-key";
import { getEventOrThrow } from "../src/lib/events/registry";
import { formatTime } from "../src/lib/events/time";

const EVENT_SLUG = "warsaw-2026";

const WRITE = process.argv.includes("--write");

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

type RunnerRow = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  locale: string;
  checkedInAt: Date | null;
  createdAt: Date;
  teamName: string | null;
};

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set (expected in .env.local)");
    process.exit(1);
  }

  // Validates the slug against the config registry (the DB has no events FK).
  const event = getEventOrThrow(EVENT_SLUG);
  if (!event.results) {
    throw new Error(`Event ${EVENT_SLUG} has no results in the registry`);
  }

  const client = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(client);

  try {
    // ---- Load source data (legacy tables, read-only) --------------------
    const runnerRows = await db.select().from(runners);
    const teamRows = await db.select({ id: teams.id, name: teams.name }).from(teams);
    const teamNameById = new Map(teamRows.map((t) => [t.id, t.name]));

    const legacyRunners: RunnerRow[] = runnerRows.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      email: normalizeEmail(r.email),
      phone: r.phone,
      locale: r.locale,
      checkedInAt: r.checkedInAt,
      createdAt: r.createdAt,
      teamName: r.teamId ? (teamNameById.get(r.teamId) ?? null) : null,
    }));

    const resultEntries = event.results.heats.flatMap((heat) =>
      heat.entries.map((entry) => ({ heat: heat.number, ...entry })),
    );

    console.log(
      `Loaded ${legacyRunners.length} legacy runners, ${resultEntries.length} results entries` +
        ` (${event.results.heats.length} heats).`,
    );

    // ---- Match results entries to runners by normalized name ------------
    const runnersByNameKey = new Map<string, RunnerRow[]>();
    for (const runner of legacyRunners) {
      const key = nameKey(runner.fullName);
      const list = runnersByNameKey.get(key) ?? [];
      list.push(runner);
      runnersByNameKey.set(key, list);
    }

    type Entry = (typeof resultEntries)[number];
    type Matched = { entry: Entry; runner: RunnerRow; via: string };
    let matched: Matched[] = [];
    const unmatched: Entry[] = [];
    const ambiguous: { entry: Entry; candidates: RunnerRow[]; reason: string }[] = [];

    for (const entry of resultEntries) {
      const candidates = runnersByNameKey.get(nameKey(entry.name)) ?? [];
      const uniqueEmails = new Set(candidates.map((c) => c.email));
      if (candidates.length === 0) {
        unmatched.push(entry);
      } else if (uniqueEmails.size === 1) {
        // One person (possibly duplicate rows); first row represents them.
        matched.push({ entry, runner: candidates[0], via: "name" });
      } else {
        // Same name, different people — corroborate with check-in timestamps:
        // if all check-ins for this name belong to one person, they finished.
        const checkedInEmails = new Set(
          candidates.filter((c) => c.checkedInAt).map((c) => c.email),
        );
        if (checkedInEmails.size === 1) {
          const email = [...checkedInEmails][0];
          const runner = candidates.find((c) => c.email === email)!;
          matched.push({ entry, runner, via: "name + check-in" });
        } else {
          ambiguous.push({ entry, candidates, reason: "same name, different people" });
        }
      }
    }

    // Never guess: if several results entries resolved to the same person,
    // at least one attribution is wrong — send them all to manual resolution.
    const entriesByEmail = new Map<string, Matched[]>();
    for (const m of matched) {
      const list = entriesByEmail.get(m.runner.email) ?? [];
      list.push(m);
      entriesByEmail.set(m.runner.email, list);
    }
    for (const [, list] of entriesByEmail) {
      if (list.length > 1) {
        for (const m of list) {
          ambiguous.push({
            entry: m.entry,
            candidates: [m.runner],
            reason: "multiple results entries resolved to this runner",
          });
        }
      }
    }
    matched = matched.filter((m) => (entriesByEmail.get(m.runner.email) ?? []).length === 1);

    // Emails whose results match makes them attended (any row of the person).
    const attendedByResultsEmails = new Set(matched.map((m) => m.runner.email));

    // ---- Collapse runners to one planned user per unique email ----------
    const runnersByEmail = new Map<string, RunnerRow[]>();
    for (const runner of [...legacyRunners].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    )) {
      const list = runnersByEmail.get(runner.email) ?? [];
      list.push(runner);
      runnersByEmail.set(runner.email, list);
    }

    type PlannedPerson = {
      email: string;
      name: string;
      phone: string;
      locale: string;
      teamName: string | null;
      attended: boolean;
      attendedVia: string[];
      rowCount: number;
    };

    const people: PlannedPerson[] = [...runnersByEmail.entries()].map(([email, rows]) => {
      const first = rows[0];
      const inResults = attendedByResultsEmails.has(email);
      const checkedIn = rows.some((r) => r.checkedInAt);
      const attendedVia: string[] = [];
      if (inResults) attendedVia.push("results");
      if (checkedIn) attendedVia.push("check-in");
      return {
        email,
        name: first.fullName,
        phone: first.phone,
        locale: first.locale,
        teamName: first.teamName,
        attended: inResults || checkedIn,
        attendedVia,
        rowCount: rows.length,
      };
    });

    // ---- Compare against current users / participations ------------------
    const emails = people.map((p) => p.email);
    // Case-insensitive on the DB side: users created through other paths may
    // carry mixed-case emails, and unique(email) would not stop a duplicate.
    const existingUsers = emails.length
      ? await db
          .select({ id: users.id, email: users.email })
          .from(users)
          .where(inArray(sql`lower(${users.email})`, emails))
      : [];
    const existingUserIdByEmail = new Map(
      existingUsers.map((u) => [normalizeEmail(u.email), u.id]),
    );

    const participationsTableExists = (
      await client`select exists(
        select from information_schema.tables
        where table_schema = 'public' and table_name = 'legacy_participations'
      ) as x`
    )[0].x as boolean;

    if (!participationsTableExists && WRITE) {
      console.error(
        "\nlegacy_participations table does not exist — run `npm run db:migrate` first.",
      );
      process.exit(1);
    }

    const existingParticipations = participationsTableExists
      ? await db
          .select({
            userId: legacyParticipations.userId,
            attended: legacyParticipations.attended,
          })
          .from(legacyParticipations)
          .where(eq(legacyParticipations.eventSlug, EVENT_SLUG))
      : [];
    const existingParticipationByUserId = new Map(
      existingParticipations.map((p) => [p.userId, p]),
    );

    // Resolve each person once; the dry-run report and the write path both
    // read these fields so their counts cannot drift apart.
    const resolved = people.map((person) => {
      const existingUserId = existingUserIdByEmail.get(person.email) ?? null;
      const existingParticipation = existingUserId
        ? (existingParticipationByUserId.get(existingUserId) ?? null)
        : null;
      return { ...person, existingUserId, existingParticipation };
    });

    const newUsers = resolved.filter((p) => !p.existingUserId);
    const existingUserAttach = resolved.filter((p) => p.existingUserId);
    const duplicateEmailMerges = resolved.filter((p) => p.rowCount > 1);
    const checkInOnly = resolved.filter((p) => p.attended && !p.attendedVia.includes("results"));
    const participationsToInsert = resolved.filter((p) => !p.existingParticipation);
    const flagUpdates = resolved.filter(
      (p) => p.existingParticipation && p.existingParticipation.attended !== p.attended,
    );
    const attendedCount = resolved.filter((p) => p.attended).length;

    // ---- Report ----------------------------------------------------------
    const line = (s = "") => console.log(s);
    line();
    line(`=== Results matching (${EVENT_SLUG}) ===`);
    line(`Matched: ${matched.length}/${resultEntries.length}`);
    for (const m of matched) {
      line(
        `  heat ${m.entry.heat} #${m.entry.place} ${m.entry.name} (${formatTime(m.entry.timeCs)})` +
          ` -> ${m.runner.fullName} <${m.runner.email}> [${m.via}]`,
      );
    }
    line();
    line(`Unmatched results entries (no runner row — reported, NOT imported): ${unmatched.length}`);
    for (const e of unmatched) {
      line(`  heat ${e.heat} #${e.place} bib ${e.bib} ${e.name} (${formatTime(e.timeCs)})`);
    }
    line();
    line(
      `Ambiguous matches (manual resolution needed, NOT counted as attended): ${ambiguous.length}`,
    );
    for (const a of ambiguous) {
      line(`  heat ${a.entry.heat} #${a.entry.place} ${a.entry.name} — ${a.reason}:`);
      for (const c of a.candidates) {
        line(
          `    candidate ${c.fullName} <${c.email}>` +
            (c.checkedInAt ? ` (checked in ${c.checkedInAt.toISOString()})` : " (not checked in)"),
        );
      }
    }
    line();
    line(`Check-in-corroborated attendance without a results match: ${checkInOnly.length}`);
    for (const p of checkInOnly) line(`  ${p.name} <${p.email}>`);
    line();
    line(`Duplicate emails among runners (merged to one user each): ${duplicateEmailMerges.length}`);
    for (const p of duplicateEmailMerges) {
      line(`  <${p.email}> x${p.rowCount} rows -> name "${p.name}" (first row wins)`);
    }
    line();
    line(`Existing users (participation attached, profile untouched): ${existingUserAttach.length}`);
    for (const p of existingUserAttach) line(`  <${p.email}>`);
    line();
    line("=== Planned writes ===");
    line(`Unique runner emails: ${resolved.length}`);
    line(`New unverified users to create: ${newUsers.length}`);
    if (!participationsTableExists) {
      line("(legacy_participations table missing — existing-row dedup skipped in this dry-run)");
    }
    line(
      `Participations to insert: ${participationsToInsert.length}` +
        ` (${attendedCount}/${resolved.length} people attended)`,
    );
    line(`Attended-flag updates on existing participations: ${flagUpdates.length}`);

    if (!WRITE) {
      line();
      line("Dry-run complete — nothing written. Re-run with --write to import.");
      return;
    }

    // ---- Write ------------------------------------------------------------
    line();
    line("=== Writing ===");
    let usersCreated = 0;
    let participationsCreated = 0;
    let flagsUpdated = 0;

    await db.transaction(async (tx) => {
      for (const person of resolved) {
        let userId = person.existingUserId;
        if (!userId) {
          userId = nanoid(32);
          // Deliberately profile-incomplete: name/phone/locale only, no
          // firstName/lastName/dateOfBirth/sex, unverified, no password —
          // the existing profile gate fires before any registration. No
          // conflict clause: a user created concurrently since the snapshot
          // aborts the transaction loudly rather than importing against a
          // stale view; re-run after it settles.
          await tx.insert(users).values({
            id: userId,
            name: person.name,
            email: person.email,
            emailVerified: false,
            phone: person.phone,
            locale: person.locale,
          });
          usersCreated += 1;
        }

        if (!person.existingParticipation) {
          const inserted = await tx
            .insert(legacyParticipations)
            .values({
              userId,
              eventSlug: EVENT_SLUG,
              attended: person.attended,
              teamName: person.teamName,
            })
            .onConflictDoNothing()
            .returning({ id: legacyParticipations.id });
          participationsCreated += inserted.length;
        } else if (person.existingParticipation.attended !== person.attended) {
          // Results-file fix path: upsert only the attended flag.
          await tx
            .update(legacyParticipations)
            .set({ attended: person.attended })
            .where(
              and(
                eq(legacyParticipations.eventSlug, EVENT_SLUG),
                eq(legacyParticipations.userId, userId),
              ),
            );
          flagsUpdated += 1;
        }
      }
    });

    line(`Users created: ${usersCreated}`);
    line(`Participations created: ${participationsCreated}`);
    line(`Attended flags updated: ${flagsUpdated}`);
    line("Import complete.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
