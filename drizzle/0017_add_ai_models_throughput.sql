-- Add throughput column to ai_models and index for sorting/filtering
ALTER TABLE "ai_models" ADD COLUMN IF NOT EXISTS "throughput" double precision;

CREATE INDEX IF NOT EXISTS "ai_models_throughput_idx" ON "ai_models" USING btree ("throughput");
