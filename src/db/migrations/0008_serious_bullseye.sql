DROP TABLE "event_slot_counters" CASCADE;--> statement-breakpoint
DROP TABLE "pending_event_registrations" CASCADE;--> statement-breakpoint
ALTER TABLE "event_registrations" DROP COLUMN "payment_status";--> statement-breakpoint
ALTER TABLE "event_registrations" DROP COLUMN "free_slot";--> statement-breakpoint
ALTER TABLE "event_registrations" DROP COLUMN "stripe_session_id";