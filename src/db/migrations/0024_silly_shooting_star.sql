CREATE TABLE "consent_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"doc_set" text NOT NULL,
	"locale" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "registration_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"item_id" text NOT NULL,
	"kind" text NOT NULL,
	"doc_slug" text NOT NULL,
	"doc_version" text NOT NULL,
	"value" text NOT NULL,
	"withdrawn_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "consent_submissions" ADD CONSTRAINT "consent_submissions_registration_id_event_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."event_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_consents" ADD CONSTRAINT "registration_consents_submission_id_consent_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."consent_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consent_submissions_registration_idx" ON "consent_submissions" USING btree ("registration_id");--> statement-breakpoint
CREATE UNIQUE INDEX "registration_consents_submission_item_uq" ON "registration_consents" USING btree ("submission_id","item_id");--> statement-breakpoint
CREATE INDEX "registration_consents_consent_value_idx" ON "registration_consents" USING btree ("item_id","value") WHERE "registration_consents"."kind" = 'consent';