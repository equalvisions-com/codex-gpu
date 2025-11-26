CREATE TABLE IF NOT EXISTS "model_latency_samples" (
  "permaslug" text NOT NULL,
  "endpoint_id" text NOT NULL,
  "observed_at" timestamp NOT NULL,
  "latency" double precision NOT NULL,
  "scraped_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "model_latency_samples_pk" PRIMARY KEY ("permaslug", "endpoint_id", "observed_at")
);

CREATE INDEX IF NOT EXISTS "model_latency_permaslug_idx"
  ON "model_latency_samples" ("permaslug");

CREATE INDEX IF NOT EXISTS "model_latency_endpoint_idx"
  ON "model_latency_samples" ("endpoint_id");

CREATE INDEX IF NOT EXISTS "model_latency_observed_idx"
  ON "model_latency_samples" ("observed_at");
