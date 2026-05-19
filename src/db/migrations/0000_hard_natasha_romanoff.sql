CREATE TYPE "public"."team_category" AS ENUM('mens', 'womens', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."team_status" AS ENUM('open', 'locked', 'final', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."assignment_status" AS ENUM('assigned', 'pending_assignment', 'n/a');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('free', 'paid', 'pending', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."registration_type" AS ENUM('captain', 'team_member', 'free_agent', 'solo');--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" "team_category" NOT NULL,
	"region" text NOT NULL,
	"status" "team_status" DEFAULT 'open' NOT NULL,
	"free_slot" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	CONSTRAINT "teams_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "runners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid,
	"registration_type" "registration_type" NOT NULL,
	"assignment_status" "assignment_status" DEFAULT 'n/a' NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"dob" date NOT NULL,
	"gender" "gender" NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"nationality" text NOT NULL,
	"club" text,
	"coach" text,
	"personal_best_seconds" integer,
	"age_category" text NOT NULL,
	"preferred_region" text,
	"preferred_teammates" text,
	"free_slot" boolean DEFAULT false NOT NULL,
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"stripe_session_id" text,
	"consents" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slot_counter" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"free_teams_claimed" integer DEFAULT 0 NOT NULL,
	"free_runners_claimed" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "slot_counter_singleton_id" CHECK ("slot_counter"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "magic_links" (
	"token" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"team_id" uuid,
	"runner_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payload" jsonb NOT NULL,
	"stripe_session_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pending_registrations_stripe_session_id_unique" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
ALTER TABLE "runners" ADD CONSTRAINT "runners_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_links" ADD CONSTRAINT "magic_links_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_links" ADD CONSTRAINT "magic_links_runner_id_runners_id_fk" FOREIGN KEY ("runner_id") REFERENCES "public"."runners"("id") ON DELETE no action ON UPDATE no action;