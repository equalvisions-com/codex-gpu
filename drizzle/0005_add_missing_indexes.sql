-- Add missing indexes for optimal query performance
-- These indexes will significantly improve p95/p99 latency for database-level filtering/sorting/pagination

-- 1. Author index: for filtering by author
CREATE INDEX IF NOT EXISTS "ai_models_author_idx" ON "ai_models" USING btree ("author");

-- 2. Context length index: for range queries and sorting
CREATE INDEX IF NOT EXISTS "ai_models_context_length_idx" ON "ai_models" USING btree ("context_length");

-- 3. MMLU index: for sorting by MMLU score
CREATE INDEX IF NOT EXISTS "ai_models_mmlu_idx" ON "ai_models" USING btree ("mmlu");

-- 4. Output modalities index: for filtering by output modalities (complement to input_modalities)
CREATE INDEX IF NOT EXISTS "ai_models_output_modalities_idx" ON "ai_models" USING btree ("output_modalities");

-- 5. CRITICAL: modelId index on userModelFavorites for JOIN performance
-- This is the most important missing index for favorites queries
CREATE INDEX IF NOT EXISTS "user_model_favorites_model_id_idx" ON "user_model_favorites" USING btree ("model_id");

-- 6. Composite index for common sort patterns (provider + name for default sorting)
CREATE INDEX IF NOT EXISTS "ai_models_provider_name_idx" ON "ai_models" USING btree ("provider", "name");

