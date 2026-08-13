CREATE TABLE "event_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_slug" text NOT NULL,
	"heat_number" integer NOT NULL,
	"bib" integer NOT NULL,
	"status" text DEFAULT 'finished' NOT NULL,
	"time_cs" integer,
	"place" integer,
	"name" text NOT NULL,
	"gender" text NOT NULL,
	"registration_id" uuid,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_results" ADD CONSTRAINT "event_results_registration_id_event_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."event_registrations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_results_event_heat_bib_uq" ON "event_results" USING btree ("event_slug","heat_number","bib");