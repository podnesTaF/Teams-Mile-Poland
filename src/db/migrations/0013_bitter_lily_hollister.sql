ALTER TYPE "public"."participation_status" ADD VALUE 'confirmed' BEFORE 'checked_in';--> statement-breakpoint
CREATE TABLE "event_heats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_slug" text NOT NULL,
	"number" integer NOT NULL,
	"capacity" integer NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "event_registrations_event_bib_uq";--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "bib_returned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "heat_id" uuid;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "notified_heat_id" uuid;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "notified_heat_time" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "event_heats_event_number_uq" ON "event_heats" USING btree ("event_slug","number");--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_heat_id_event_heats_id_fk" FOREIGN KEY ("heat_id") REFERENCES "public"."event_heats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_registrations_event_bib_held_uq" ON "event_registrations" USING btree ("event_slug","bib") WHERE "event_registrations"."bib" is not null and "event_registrations"."bib_returned_at" is null;--> statement-breakpoint
-- Backfill for ADR 0003: under the old code a row leaving `checked_in` kept its
-- `bib`, so it would now read as still holding the lease. Stamp those returned
-- so the pool is accurate from the first check-in.
UPDATE "event_registrations" SET "bib_returned_at" = now() WHERE "bib" is not null AND "status" <> 'checked_in';