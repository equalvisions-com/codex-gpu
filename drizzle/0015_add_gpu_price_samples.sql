CREATE TABLE IF NOT EXISTS "gpu_price_samples" (
  "stable_key" text NOT NULL,
  "provider" text NOT NULL,
  "observed_at" timestamp NOT NULL,
  "price_usd" double precision NOT NULL,
  "scraped_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "gpu_price_samples_pk" PRIMARY KEY ("stable_key", "observed_at")
);

CREATE INDEX IF NOT EXISTS "gpu_price_samples_stable_key_idx"
  ON "gpu_price_samples" ("stable_key");

CREATE INDEX IF NOT EXISTS "gpu_price_samples_provider_idx"
  ON "gpu_price_samples" ("provider");

CREATE INDEX IF NOT EXISTS "gpu_price_samples_observed_idx"
  ON "gpu_price_samples" ("observed_at");
