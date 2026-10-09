ALTER TABLE "event_registrations" ADD COLUMN "race_format" text DEFAULT 'individual' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "team_id" uuid;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_team_id_user_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."user_teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Backfill (ADR 0016): every registration on a night still open for
-- registration whose runner is on a placement roster becomes a team-race row
-- for that team. Completed nights are left alone (their team runners are in
-- team_results). Earliest membership wins, as in placementTeamFor().
UPDATE "event_registrations" AS r
SET "race_format" = 'team', "team_id" = p."team_id"
FROM (
  SELECT DISTINCT ON (m."user_id") m."user_id", m."team_id"
  FROM "user_team_members" m
  JOIN "user_teams" t ON t."id" = m."team_id"
  WHERE t."slug" IN ('ab-praga-poludnie', 'ab-wilanow', 'ab-praga-poludnie-2', 'ab-wilanow-2')
  ORDER BY m."user_id", m."joined_at", m."id"
) AS p, "events" AS e
WHERE p."user_id" = r."user_id"
  AND e."slug" = r."event_slug"
  AND e."status" = 'registration_open';
