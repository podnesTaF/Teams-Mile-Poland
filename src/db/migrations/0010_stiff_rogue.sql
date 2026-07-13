CREATE TABLE "legacy_participations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"event_slug" text NOT NULL,
	"attended" boolean DEFAULT false NOT NULL,
	"team_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_broadcast_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"broadcast_id" uuid NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" text NOT NULL,
	"body_html" text NOT NULL,
	"segment" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "marketing_opt_out" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "legacy_participations" ADD CONSTRAINT "legacy_participations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_broadcast_log" ADD CONSTRAINT "user_broadcast_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_broadcast_log" ADD CONSTRAINT "user_broadcast_log_broadcast_id_user_broadcasts_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."user_broadcasts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_participations_event_user_uq" ON "legacy_participations" USING btree ("event_slug","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_broadcast_log_user_broadcast_uq" ON "user_broadcast_log" USING btree ("user_id","broadcast_id");