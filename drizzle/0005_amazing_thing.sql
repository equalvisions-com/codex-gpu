CREATE INDEX "ai_models_author_idx" ON "ai_models" USING btree ("author");--> statement-breakpoint
CREATE INDEX "ai_models_context_length_idx" ON "ai_models" USING btree ("context_length");--> statement-breakpoint
CREATE INDEX "ai_models_mmlu_idx" ON "ai_models" USING btree ("mmlu");--> statement-breakpoint
CREATE INDEX "ai_models_output_modalities_idx" ON "ai_models" USING btree ("output_modalities");--> statement-breakpoint
CREATE INDEX "ai_models_provider_name_idx" ON "ai_models" USING btree ("provider","name");--> statement-breakpoint
CREATE INDEX "user_model_favorites_model_id_idx" ON "user_model_favorites" USING btree ("model_id");