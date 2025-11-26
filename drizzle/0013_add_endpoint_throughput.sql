ALTER TABLE "ai_models"
ADD COLUMN IF NOT EXISTS "endpoint_id" text;

CREATE TABLE IF NOT EXISTS "model_throughput_samples" (
  "permaslug" text NOT NULL,
  "endpoint_id" text NOT NULL,
  "observed_at" timestamp NOT NULL,
  "throughput" double precision NOT NULL,
  "scraped_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "model_throughput_samples_pk" PRIMARY KEY ("permaslug", "endpoint_id", "observed_at")
);

CREATE INDEX IF NOT EXISTS "model_throughput_permaslug_idx"
  ON "model_throughput_samples" ("permaslug");

CREATE INDEX IF NOT EXISTS "model_throughput_endpoint_idx"
  ON "model_throughput_samples" ("endpoint_id");

CREATE INDEX IF NOT EXISTS "model_throughput_observed_idx"
  ON "model_throughput_samples" ("observed_at");
