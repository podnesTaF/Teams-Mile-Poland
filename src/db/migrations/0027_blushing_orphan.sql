ALTER TABLE "wallet_transactions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD COLUMN "team_id" uuid;--> statement-breakpoint
CREATE INDEX "wallet_tx_team_asset_idx" ON "wallet_transactions" USING btree ("team_id","asset") WHERE "wallet_transactions"."team_id" is not null;--> statement-breakpoint
CREATE INDEX "wallet_tx_team_created_idx" ON "wallet_transactions" USING btree ("team_id","created_at") WHERE "wallet_transactions"."team_id" is not null;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_tx_one_owner" CHECK (("wallet_transactions"."user_id" is null) <> ("wallet_transactions"."team_id" is null));