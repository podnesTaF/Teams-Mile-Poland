CREATE TABLE "wallet_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"asset" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"reference" text,
	"memo" text,
	"created_by" text,
	"reverses_id" uuid,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_reverses_id_wallet_transactions_id_fk" FOREIGN KEY ("reverses_id") REFERENCES "public"."wallet_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_tx_idempotency_uq" ON "wallet_transactions" USING btree ("idempotency_key") WHERE "wallet_transactions"."idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX "wallet_tx_user_asset_idx" ON "wallet_transactions" USING btree ("user_id","asset");--> statement-breakpoint
CREATE INDEX "wallet_tx_user_created_idx" ON "wallet_transactions" USING btree ("user_id","created_at");