ALTER TABLE "ai_models" ADD COLUMN "max_completion_tokens" integer;--> statement-breakpoint
CREATE INDEX "ai_models_max_completion_tokens_idx" ON "ai_models" USING btree ("max_completion_tokens");