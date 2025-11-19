ALTER TABLE "ai_models" ADD COLUMN "prompt_price" double precision;
ALTER TABLE "ai_models" ADD COLUMN "completion_price" double precision;
ALTER TABLE "ai_models" ADD COLUMN "modality_score" integer;

UPDATE "ai_models" AS m
SET
  "prompt_price" = CASE
    WHEN m.pricing->>'prompt' IS NULL OR m.pricing->>'prompt' = '' THEN NULL
    ELSE (m.pricing->>'prompt')::double precision
  END,
  "completion_price" = CASE
    WHEN m.pricing->>'completion' IS NULL OR m.pricing->>'completion' = '' THEN NULL
    ELSE (m.pricing->>'completion')::double precision
  END,
  "modality_score" = (
    SELECT COALESCE(COUNT(DISTINCT modality), 0)
    FROM (
      SELECT unnest(COALESCE(m."input_modalities", ARRAY[]::text[])) AS modality
      UNION
      SELECT unnest(COALESCE(m."output_modalities", ARRAY[]::text[])) AS modality
    ) AS combined
  );

CREATE INDEX IF NOT EXISTS "ai_models_prompt_price_idx" ON "ai_models" ("prompt_price");
CREATE INDEX IF NOT EXISTS "ai_models_completion_price_idx" ON "ai_models" ("completion_price");
CREATE INDEX IF NOT EXISTS "ai_models_modality_score_idx" ON "ai_models" ("modality_score");
CREATE INDEX IF NOT EXISTS "ai_models_normalized_name_idx" ON "ai_models" ((COALESCE(lower(trim("short_name")), lower(trim("name")), '')));
