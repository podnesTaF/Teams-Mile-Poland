ALTER TYPE "public"."event_email_kind" ADD VALUE 'team_confirm_request';--> statement-breakpoint
ALTER TYPE "public"."event_email_kind" ADD VALUE 'team_entry_withdrawn';--> statement-breakpoint
CREATE TABLE "team_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"event_slug" text NOT NULL,
	"category" text NOT NULL,
	"entered_by_user_id" text,
	"rating_rules_version" text NOT NULL,
	"status" text DEFAULT 'entered' NOT NULL,
	"heat_id" uuid,
	"checked_in_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_entry_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"registration_id" uuid NOT NULL,
	"race_role" text,
	"pair_no" integer,
	"stage_option" text,
	"is_reserve" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_heats" ADD COLUMN "capacity_teams" integer;--> statement-breakpoint
ALTER TABLE "event_heats" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "team_entry_id" uuid;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "consent_pending" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "team_entries" ADD CONSTRAINT "team_entries_team_id_user_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."user_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_entries" ADD CONSTRAINT "team_entries_entered_by_user_id_users_id_fk" FOREIGN KEY ("entered_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_entries" ADD CONSTRAINT "team_entries_heat_id_event_heats_id_fk" FOREIGN KEY ("heat_id") REFERENCES "public"."event_heats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_entry_members" ADD CONSTRAINT "team_entry_members_entry_id_team_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."team_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_entry_members" ADD CONSTRAINT "team_entry_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_entry_members" ADD CONSTRAINT "team_entry_members_registration_id_event_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."event_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_entries_team_event_uq" ON "team_entries" USING btree ("team_id","event_slug");--> statement-breakpoint
CREATE INDEX "team_entries_event_idx" ON "team_entries" USING btree ("event_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "team_entry_members_entry_user_uq" ON "team_entry_members" USING btree ("entry_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_entry_members_registration_uq" ON "team_entry_members" USING btree ("registration_id");--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_team_entry_id_team_entries_id_fk" FOREIGN KEY ("team_entry_id") REFERENCES "public"."team_entries"("id") ON DELETE set null ON UPDATE no action;