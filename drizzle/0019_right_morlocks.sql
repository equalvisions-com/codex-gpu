DROP INDEX "user_tool_favorites_tool_id_idx";--> statement-breakpoint
DROP INDEX "user_tool_unique";--> statement-breakpoint
ALTER TABLE "tools" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "price" text;--> statement-breakpoint
ALTER TABLE "user_tool_favorites" ADD COLUMN "tool_stable_key" text NOT NULL;--> statement-breakpoint
CREATE INDEX "tools_price_idx" ON "tools" USING btree ("price");--> statement-breakpoint
CREATE INDEX "user_tool_favorites_tool_stable_key_idx" ON "user_tool_favorites" USING btree ("tool_stable_key");--> statement-breakpoint
CREATE UNIQUE INDEX "user_tool_unique" ON "user_tool_favorites" USING btree ("user_id","tool_stable_key");--> statement-breakpoint
ALTER TABLE "user_tool_favorites" DROP COLUMN "tool_id";