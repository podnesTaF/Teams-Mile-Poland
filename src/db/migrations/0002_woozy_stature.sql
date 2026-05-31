ALTER TABLE "runners" ADD COLUMN "checked_in_at" timestamp with time zone;--> statement-breakpoint
DROP TYPE "public"."team_category";--> statement-breakpoint
DROP TYPE "public"."gender";