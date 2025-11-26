DROP INDEX "ai_models_provider_name_idx";--> statement-breakpoint
CREATE INDEX "ai_models_provider_name_idx" ON "ai_models" USING btree ("provider","short_name");