CREATE TYPE "public"."event_email_kind" AS ENUM('reminder_7d', 'reminder_3d', 'reminder_1d', 'morning');--> statement-breakpoint
CREATE TABLE "event_email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_registration_id" uuid NOT NULL,
	"kind" "event_email_kind" NOT NULL,
	"status" "email_status" NOT NULL,
	"error" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_email_log" ADD CONSTRAINT "event_email_log_event_registration_id_event_registrations_id_fk" FOREIGN KEY ("event_registration_id") REFERENCES "public"."event_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_email_log_registration_kind_unique" ON "event_email_log" USING btree ("event_registration_id","kind");