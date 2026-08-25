-- ###########################################################################
-- ## HAND-EDITED: the seed INSERTs below were appended by hand.             ##
-- ###########################################################################
--
-- The DDL above is drizzle-kit's; everything after the last statement-
-- breakpoint is not, and re-running `db:generate` will not reproduce it. Do not
-- regenerate this file — edit it.
--
-- WHY the seed lives in the migration rather than a script: events *were*
-- compile-time config (`src/lib/events/registry.ts` exported a literal `EVENTS`
-- array). This migration is the moment they become rows, so the table must
-- arrive already holding the five events the registry knew — otherwise the
-- deploy that lands this code renders a site with no featured event and no
-- event pages. Putting it here means preview and production get identical data
-- with no manual step, and `on conflict do nothing` makes a re-run harmless.
--
-- BEFORE APPLYING: check `when` in `src/db/migrations/meta/_journal.json`
-- (1787238106710) against the live watermark. A migration whose `when` predates
-- the watermark is skipped **in silence** — this has bitten this project once
-- already. Neon branch first, then production.
--
-- NOTE ON `status` / `event_type`: plain `text`, not a pgEnum. `ALTER TYPE …
-- ADD VALUE` cannot run inside a transaction and stranded migration 0012 on the
-- live DB; `users.role`, `event_results.status` and the wallet columns all set
-- this precedent. The consequence that matters: the `draft` and `cancelled`
-- states coming next need NO migration at all.

CREATE TABLE "events" (
	"slug" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"event_type" text NOT NULL,
	"name" text NOT NULL,
	"date" date NOT NULL,
	"start_time" text,
	"end_time" text,
	"venue" text NOT NULL,
	"city" text NOT NULL,
	"bib_pool" integer DEFAULT 50 NOT NULL,
	"heat_interval_minutes" integer DEFAULT 10 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- The five events the registry literal held, verbatim.
--
--   * `date` is the ordering key and is read back as `YYYY-MM-DD` (the schema
--     uses drizzle's `date({ mode: "string" })`), so no timezone is involved.
--   * `shortDate`, the display `timeRange` and the on-site `timetable` are all
--     DERIVED at read time (`src/lib/events/store.ts`) — that is why there are
--     no columns for them here.
--   * `warsaw-2026` is the legacy team event: no time window, so its
--     start/end are NULL and it gets no generated timetable.
--   * The two windows are the only two the series runs: morning 09:15–12:15
--     and evening 17:30–20:30.
--   * `bib_pool` 50 and `heat_interval_minutes` 10 are the column defaults
--     (ADR 0003); stated explicitly so the seeded rows do not silently change
--     meaning if a default is ever edited.
--   * `created_by` is NULL: these rows predate the admin create flow.
--
-- The 2026-08-08 night is deliberately absent. It was cancelled and removed
-- from the registry outright because the model had no `cancelled` state, and
-- its 11 registrations were re-slugged to 08-15 by hand. Do not re-create it
-- here — `/events/mile-2026-08-08` 404s today and must keep doing so.
INSERT INTO "events" (
  "slug", "status", "event_type", "name", "date",
  "start_time", "end_time", "venue", "city",
  "bib_pool", "heat_interval_minutes", "created_by"
) VALUES
  ('warsaw-2026',      'completed',         'team',       'TEAMS MILE Warsaw', '2026-06-27', NULL,    NULL,    'Stadion Podskarbińska', 'Warsaw', 50, 10, NULL),
  ('mile-2026-08-01',  'completed',         'individual', 'Individual Mile',   '2026-08-01', '09:15', '12:15', 'Stadion Podskarbińska', 'Warsaw', 50, 10, NULL),
  ('mile-2026-08-15',  'completed',         'individual', 'Individual Mile',   '2026-08-15', '09:15', '12:15', 'Stadion Podskarbińska', 'Warsaw', 50, 10, NULL),
  ('mile-2026-08-22',  'registration_open', 'individual', 'Individual Mile',   '2026-08-22', '17:30', '20:30', 'Stadion Podskarbińska', 'Warsaw', 50, 10, NULL),
  ('mile-2026-08-29',  'registration_open', 'individual', 'Individual Mile',   '2026-08-29', '09:15', '12:15', 'Stadion Podskarbińska', 'Warsaw', 50, 10, NULL)
ON CONFLICT ("slug") DO NOTHING;
