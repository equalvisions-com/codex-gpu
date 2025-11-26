CREATE TABLE "gpu_pricing" (
  "id" text PRIMARY KEY,
  "provider" text NOT NULL,
  "observed_at" timestamp NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "source_hash" text,
  "data" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "gpu_pricing_provider_idx" ON "gpu_pricing" ("provider");

CREATE INDEX "gpu_pricing_observed_at_idx" ON "gpu_pricing" ("observed_at");
