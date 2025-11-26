-- Enable trigram extension for advanced text search (idempotent)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Add stable key column for GPU pricing favorites join
ALTER TABLE "gpu_pricing" ADD COLUMN IF NOT EXISTS "stable_key" text;

-- Backfill stable key values for existing rows
UPDATE "gpu_pricing"
SET "stable_key" = trim(both ':' FROM concat_ws(
  ':',
  lower(trim("provider")),
  lower(trim(coalesce("data"->>'gpu_model', "data"->>'item', "data"->>'sku', ''))),
  CASE
    WHEN nullif(trim("data"->>'gpu_count'), '') IS NOT NULL THEN
      concat(
        (nullif(trim("data"->>'gpu_count'), '')::numeric)::text,
        'x'
      )
    ELSE NULL
  END,
  CASE
    WHEN nullif(trim("data"->>'vram_gb'), '') IS NOT NULL THEN
      concat(
        (nullif(trim("data"->>'vram_gb'), '')::numeric)::text,
        'gb'
      )
    ELSE NULL
  END,
  lower(trim(coalesce("data"->>'type', '')))
))
WHERE "stable_key" IS NULL;

-- Ensure column is present and non-null for future inserts
ALTER TABLE "gpu_pricing"
  ALTER COLUMN "stable_key" SET NOT NULL;

-- GPU pricing performance indexes
CREATE INDEX IF NOT EXISTS "gpu_pricing_stable_key_idx" ON "gpu_pricing" USING btree ("stable_key");
CREATE INDEX IF NOT EXISTS "gpu_pricing_vram_idx" ON "gpu_pricing" ((CAST("data"->>'vram_gb' AS NUMERIC)));
CREATE INDEX IF NOT EXISTS "gpu_pricing_price_idx" ON "gpu_pricing" ((COALESCE(
  CAST("data"->>'price_hour_usd' AS NUMERIC),
  CAST("data"->>'price_usd' AS NUMERIC)
)));
CREATE INDEX IF NOT EXISTS "gpu_pricing_model_trgm_idx" ON "gpu_pricing" USING gin ((coalesce("data"->>'gpu_model', "data"->>'item', "data"->>'sku', '')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "gpu_pricing_type_trgm_idx" ON "gpu_pricing" USING gin ((coalesce("data"->>'type', '')) gin_trgm_ops);

-- Replace modality indexes with GIN for array membership checks
DROP INDEX IF EXISTS "ai_models_input_modalities_idx";
CREATE INDEX "ai_models_input_modalities_idx" ON "ai_models" USING gin ("input_modalities");

DROP INDEX IF EXISTS "ai_models_output_modalities_idx";
CREATE INDEX "ai_models_output_modalities_idx" ON "ai_models" USING gin ("output_modalities");

-- Replace name/description index with full text search
DROP INDEX IF EXISTS "ai_models_name_desc_idx";
CREATE INDEX "ai_models_name_desc_idx" ON "ai_models" USING gin (
  to_tsvector('english', coalesce("name", '') || ' ' || coalesce("description", ''))
);
