CREATE TABLE "team_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_slug" text NOT NULL,
	"heat_number" integer NOT NULL,
	"team_name" text NOT NULL,
	"team_id" uuid,
	"status" text DEFAULT 'finished' NOT NULL,
	"place" integer,
	"time_cs" integer,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "event_results_event_heat_bib_uq";--> statement-breakpoint
ALTER TABLE "event_results" ALTER COLUMN "bib" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "event_results" ADD COLUMN "splits" jsonb;--> statement-breakpoint
ALTER TABLE "event_results" ADD COLUMN "team_result_id" uuid;--> statement-breakpoint
ALTER TABLE "event_results" ADD COLUMN "race_role" text;--> statement-breakpoint
ALTER TABLE "event_results" ADD COLUMN "pair_no" integer;--> statement-breakpoint
ALTER TABLE "event_results" ADD COLUMN "leg_time_cs" integer;--> statement-breakpoint
ALTER TABLE "team_results" ADD CONSTRAINT "team_results_team_id_user_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."user_teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_results_event_heat_team_uq" ON "team_results" USING btree ("event_slug","heat_number","team_name");--> statement-breakpoint
CREATE INDEX "team_results_team_idx" ON "team_results" USING btree ("team_id");--> statement-breakpoint
ALTER TABLE "event_results" ADD CONSTRAINT "event_results_team_result_id_team_results_id_fk" FOREIGN KEY ("team_result_id") REFERENCES "public"."team_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_results_team_bib_uq" ON "event_results" USING btree ("team_result_id","bib") WHERE "event_results"."team_result_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "event_results_event_heat_bib_uq" ON "event_results" USING btree ("event_slug","heat_number","bib") WHERE "event_results"."team_result_id" is null;