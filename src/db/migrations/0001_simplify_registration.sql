-- Collapse the registration data model to {fullName, email, phone, terms}.
-- Drop the runner demographic columns + jsonb consents; replace first_name + last_name
-- with a single full_name column and a single terms boolean.
-- Simplify teams: drop category + region, add size (7..12, nullable for back-compat).
-- The "solo" value in registration_type and the gender enum type are intentionally
-- left in place to avoid an enum-rebuild step; nothing in code references them now.

ALTER TABLE "runners" ADD COLUMN "full_name" text;--> statement-breakpoint
UPDATE "runners" SET "full_name" = trim(both ' ' from coalesce("first_name", '') || ' ' || coalesce("last_name", ''));--> statement-breakpoint
ALTER TABLE "runners" ALTER COLUMN "full_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "runners" ADD COLUMN "terms" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "runners" SET "terms" = true WHERE "consents" IS NOT NULL;--> statement-breakpoint

ALTER TABLE "runners" DROP COLUMN "first_name";--> statement-breakpoint
ALTER TABLE "runners" DROP COLUMN "last_name";--> statement-breakpoint
ALTER TABLE "runners" DROP COLUMN "dob";--> statement-breakpoint
ALTER TABLE "runners" DROP COLUMN "gender";--> statement-breakpoint
ALTER TABLE "runners" DROP COLUMN "nationality";--> statement-breakpoint
ALTER TABLE "runners" DROP COLUMN "club";--> statement-breakpoint
ALTER TABLE "runners" DROP COLUMN "coach";--> statement-breakpoint
ALTER TABLE "runners" DROP COLUMN "personal_best_seconds";--> statement-breakpoint
ALTER TABLE "runners" DROP COLUMN "age_category";--> statement-breakpoint
ALTER TABLE "runners" DROP COLUMN "preferred_region";--> statement-breakpoint
ALTER TABLE "runners" DROP COLUMN "preferred_teammates";--> statement-breakpoint
ALTER TABLE "runners" DROP COLUMN "consents";--> statement-breakpoint

ALTER TABLE "teams" ADD COLUMN "size" integer;--> statement-breakpoint
ALTER TABLE "teams" DROP COLUMN "category";--> statement-breakpoint
ALTER TABLE "teams" DROP COLUMN "region";
