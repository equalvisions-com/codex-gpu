CREATE TABLE "user_model_favorites" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL,
  "model_id" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "user_model_favorites_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action
);

CREATE UNIQUE INDEX "user_model_unique" ON "user_model_favorites" USING btree ("user_id","model_id");

CREATE INDEX "user_model_favorites_user_id_idx" ON "user_model_favorites" USING btree ("user_id");
