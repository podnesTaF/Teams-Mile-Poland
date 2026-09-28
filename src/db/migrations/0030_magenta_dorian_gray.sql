CREATE TABLE "event_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"event_slug" text NOT NULL,
	"user_id" text NOT NULL,
	"team_id" uuid,
	"amount_minor" integer NOT NULL,
	"currency" text DEFAULT 'pln' NOT NULL,
	"stripe_session_id" text NOT NULL,
	"stripe_payment_intent_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"payload" jsonb,
	"registration_id" uuid,
	"team_entry_id" uuid,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "individual_price_pln" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "team_price_pln" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "event_payments" ADD CONSTRAINT "event_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_payments" ADD CONSTRAINT "event_payments_team_id_user_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."user_teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_payments_session_uq" ON "event_payments" USING btree ("stripe_session_id");--> statement-breakpoint
CREATE INDEX "event_payments_event_user_idx" ON "event_payments" USING btree ("event_slug","user_id");--> statement-breakpoint
CREATE INDEX "event_payments_event_team_idx" ON "event_payments" USING btree ("event_slug","team_id") WHERE "event_payments"."team_id" is not null;