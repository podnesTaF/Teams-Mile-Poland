CREATE TYPE "public"."broadcast_segment" AS ENUM('all', 'captains', 'team_members', 'free_agents', 'team');--> statement-breakpoint
CREATE TYPE "public"."broadcast_status" AS ENUM('draft', 'sent');--> statement-breakpoint
CREATE TYPE "public"."email_kind" AS ENUM('reminder_14d', 'reminder_7d', 'reminder_3d', 'reminder_1d', 'morning', 'captain_incomplete', 'broadcast');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('sent', 'failed');--> statement-breakpoint
CREATE TABLE "broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" text NOT NULL,
	"body_html" text NOT NULL,
	"segment" "broadcast_segment" NOT NULL,
	"team_id" uuid,
	"status" "broadcast_status" DEFAULT 'draft' NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"runner_id" uuid NOT NULL,
	"kind" "email_kind" NOT NULL,
	"broadcast_id" uuid,
	"status" "email_status" NOT NULL,
	"error" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "runners" ADD COLUMN "locale" text DEFAULT 'ua' NOT NULL;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_runner_id_runners_id_fk" FOREIGN KEY ("runner_id") REFERENCES "public"."runners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_broadcast_id_broadcasts_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."broadcasts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_log_runner_kind_unique" ON "email_log" USING btree ("runner_id","kind") WHERE "email_log"."kind" <> 'broadcast';--> statement-breakpoint
CREATE UNIQUE INDEX "email_log_runner_broadcast_unique" ON "email_log" USING btree ("runner_id","broadcast_id") WHERE "email_log"."broadcast_id" is not null;