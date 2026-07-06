CREATE TYPE "public"."participation_status" AS ENUM('registered', 'checked_in', 'no_show', 'cancelled');--> statement-breakpoint
CREATE TABLE "event_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_slug" text NOT NULL,
	"user_id" text NOT NULL,
	"status" "participation_status" DEFAULT 'registered' NOT NULL,
	"bib" integer,
	"payment_status" "payment_status" DEFAULT 'free' NOT NULL,
	"free_slot" boolean DEFAULT false NOT NULL,
	"stripe_session_id" text,
	"terms" boolean DEFAULT false NOT NULL,
	"locale" text DEFAULT 'pl' NOT NULL,
	"checked_in_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_slot_counters" (
	"event_slug" text PRIMARY KEY NOT NULL,
	"free_claimed" integer DEFAULT 0 NOT NULL,
	"paid_claimed" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_event_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_slug" text NOT NULL,
	"user_id" text NOT NULL,
	"stripe_session_id" text NOT NULL,
	"locale" text DEFAULT 'pl' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pending_event_registrations_stripe_session_id_unique" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_event_registrations" ADD CONSTRAINT "pending_event_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_registrations_event_user_uq" ON "event_registrations" USING btree ("event_slug","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_registrations_event_bib_uq" ON "event_registrations" USING btree ("event_slug","bib") WHERE "event_registrations"."bib" is not null;