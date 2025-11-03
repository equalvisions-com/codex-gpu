-- Remove redundant single-column indexes covered by existing composite indexes

DROP INDEX IF EXISTS "ai_models_provider_idx";
DROP INDEX IF EXISTS "user_model_favorites_user_id_idx";
DROP INDEX IF EXISTS "user_favorites_user_id_idx";
