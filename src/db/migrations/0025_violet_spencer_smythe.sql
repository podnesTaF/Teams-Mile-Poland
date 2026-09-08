CREATE TABLE "user_team_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by_user_id" text,
	"on_behalf" boolean DEFAULT false NOT NULL,
	"status" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_by_user_id" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_team_invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "user_team_join_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"status" text NOT NULL,
	"decided_by_user_id" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"category" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"region" text NOT NULL,
	"category" text NOT NULL,
	"recruiting" boolean DEFAULT false NOT NULL,
	"description" text,
	"manager_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_teams_slug_unique" UNIQUE("slug"),
	CONSTRAINT "user_teams_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "user_team_invitations" ADD CONSTRAINT "user_team_invitations_team_id_user_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."user_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_team_invitations" ADD CONSTRAINT "user_team_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_team_invitations" ADD CONSTRAINT "user_team_invitations_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_team_join_requests" ADD CONSTRAINT "user_team_join_requests_team_id_user_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."user_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_team_join_requests" ADD CONSTRAINT "user_team_join_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_team_join_requests" ADD CONSTRAINT "user_team_join_requests_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_team_members" ADD CONSTRAINT "user_team_members_team_id_user_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."user_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_team_members" ADD CONSTRAINT "user_team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_teams" ADD CONSTRAINT "user_teams_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_team_invitations_team_email_pending_uq" ON "user_team_invitations" USING btree ("team_id",lower("email")) WHERE "user_team_invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "user_team_invitations_team_idx" ON "user_team_invitations" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_team_join_requests_team_user_pending_uq" ON "user_team_join_requests" USING btree ("team_id","user_id") WHERE "user_team_join_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "user_team_join_requests_user_idx" ON "user_team_join_requests" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_team_members_team_user_uq" ON "user_team_members" USING btree ("team_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_team_members_user_category_uq" ON "user_team_members" USING btree ("user_id","category");--> statement-breakpoint
CREATE UNIQUE INDEX "user_teams_name_lower_uq" ON "user_teams" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "user_teams_recruiting_idx" ON "user_teams" USING btree ("recruiting");