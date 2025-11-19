import { pgTable, text, timestamp, integer, jsonb, text as textType, uniqueIndex, index, doublePrecision, primaryKey, numeric } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth-schema";

// User favorites table - stores which GPU instances users have favorited
export const userFavorites = pgTable("user_favorites", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  gpuUuid: text("gpu_uuid").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Prevent duplicate favorites for the same user + GPU combination
  userGpuUnique: uniqueIndex("user_gpu_unique").on(table.userId, table.gpuUuid),
}));

// AI Models table - stores scraped AI models data (wiped daily)
export const aiModels = pgTable("ai_models", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(), // Removed unique constraint - same model can be served by multiple providers
  name: text("name"),
  shortName: text("short_name"),
  author: text("author"),
  description: text("description"),
  modelVersionGroupId: text("model_version_group_id"),
  contextLength: integer("context_length"),
  inputModalities: textType("input_modalities").array(),
  outputModalities: textType("output_modalities").array(),
  hasTextOutput: text("has_text_output"), // boolean stored as text for JSON compatibility
  group: text("group"),
  instructType: text("instruct_type"),
  permaslug: text("permaslug"),
  endpointId: text("endpoint_id"),
  mmlu: doublePrecision("mmlu"),
  maxCompletionTokens: integer("max_completion_tokens"),
  supportedParameters: textType("supported_parameters").array(),
  modalityScore: integer("modality_score"),

  // Complex nested data stored as JSONB
  pricing: jsonb("pricing"),
  features: jsonb("features"),
  promptPrice: doublePrecision("prompt_price"),
  completionPrice: doublePrecision("completion_price"),

  // Metadata
  provider: text("provider").notNull(),
  scrapedAt: timestamp("scraped_at").defaultNow().notNull(),
}, (table) => ({
  // Optimize queries by slug (no longer unique - same model can be served by multiple providers)
  slugIndex: index("ai_models_slug_idx").on(table.slug),
  // Optimize queries by author (for filtering)
  authorIndex: index("ai_models_author_idx").on(table.author),
  // Optimize queries by context length (for range queries and sorting)
  contextLengthIndex: index("ai_models_context_length_idx").on(table.contextLength),
  // Optimize queries by MMLU score (for sorting)
  mmluIndex: index("ai_models_mmlu_idx").on(table.mmlu),
  // Optimize queries by max completion tokens (for sorting)
  maxCompletionTokensIndex: index("ai_models_max_completion_tokens_idx").on(table.maxCompletionTokens),
  // Optimize queries by input modalities
  inputModalitiesIndex: index("ai_models_input_modalities_idx").using("gin", table.inputModalities),
  // Optimize queries by output modalities (complement to inputModalities)
  outputModalitiesIndex: index("ai_models_output_modalities_idx").using("gin", table.outputModalities),
  // Full-text search on name and description
  nameDescIndex: index("ai_models_name_desc_idx").using(
    "gin",
    sql`to_tsvector('english', coalesce(${table.name}, '') || ' ' || coalesce(${table.description}, ''))`
  ),
  // Composite index for default sorting (provider, short_name)
  providerNameIndex: index("ai_models_provider_name_idx").on(table.provider, table.shortName),
  // GIN index for pricing queries
  pricingIndex: index("ai_models_pricing_idx").using("gin", table.pricing),
  promptPriceIndex: index("ai_models_prompt_price_idx").on(table.promptPrice),
  completionPriceIndex: index("ai_models_completion_price_idx").on(table.completionPrice),
  normalizedNameIndex: index("ai_models_normalized_name_idx").on(
    sql`(COALESCE(lower(trim(${table.shortName})), lower(trim(${table.name})), ''))`
  ),
  modalityScoreIndex: index("ai_models_modality_score_idx").on(table.modalityScore),
}));

export const modelThroughputSamples = pgTable("model_throughput_samples", {
  permaslug: text("permaslug").notNull(),
  endpointId: text("endpoint_id").notNull(),
  observedAt: timestamp("observed_at").notNull(),
  throughput: doublePrecision("throughput").notNull(),
  scrapedAt: timestamp("scraped_at").defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.permaslug, table.endpointId, table.observedAt] }),
  permaslugIdx: index("model_throughput_permaslug_idx").on(table.permaslug),
  endpointIdx: index("model_throughput_endpoint_idx").on(table.endpointId),
  observedIdx: index("model_throughput_observed_idx").on(table.observedAt),
}));

export const modelLatencySamples = pgTable("model_latency_samples", {
  permaslug: text("permaslug").notNull(),
  endpointId: text("endpoint_id").notNull(),
  observedAt: timestamp("observed_at").notNull(),
  latency: doublePrecision("latency").notNull(),
  scrapedAt: timestamp("scraped_at").defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.permaslug, table.endpointId, table.observedAt] }),
  permaslugIdx: index("model_latency_permaslug_idx").on(table.permaslug),
  endpointIdx: index("model_latency_endpoint_idx").on(table.endpointId),
  observedIdx: index("model_latency_observed_idx").on(table.observedAt),
}));

export const gpuPriceSamples = pgTable("gpu_price_samples", {
  stableKey: text("stable_key").notNull(),
  provider: text("provider").notNull(),
  observedAt: timestamp("observed_at").notNull(),
  priceUsd: doublePrecision("price_usd").notNull(),
  scrapedAt: timestamp("scraped_at").defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.stableKey, table.observedAt] }),
  stableKeyIdx: index("gpu_price_samples_stable_key_idx").on(table.stableKey),
  providerIdx: index("gpu_price_samples_provider_idx").on(table.provider),
  observedIdx: index("gpu_price_samples_observed_idx").on(table.observedAt),
}));

// GPU Pricing table - stores scraped GPU pricing data (wiped on each scrape)
export const gpuPricing = pgTable("gpu_pricing", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  observedAt: timestamp("observed_at").notNull(),
  version: integer("version").notNull().default(1),
  sourceHash: text("source_hash"),
  data: jsonb("data").notNull(),
  stableKey: text("stable_key").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  providerIndex: index("gpu_pricing_provider_idx").on(table.provider),
  observedAtIndex: index("gpu_pricing_observed_at_idx").on(table.observedAt),
  // GIN index for JSONB queries (filtering, sorting on data fields)
  dataIndex: index("gpu_pricing_data_idx").using("gin", table.data),
  vramIndex: index("gpu_pricing_vram_idx").on(
    sql`(CAST(${table.data}->>'vram_gb' AS NUMERIC))`
  ),
  priceIndex: index("gpu_pricing_price_idx").on(
    sql`(COALESCE(
      CAST(${table.data}->>'price_hour_usd' AS NUMERIC),
      CAST(${table.data}->>'price_usd' AS NUMERIC)
    ))`
  ),
  modelSearchIndex: index("gpu_pricing_model_trgm_idx").using(
    "gin",
    sql`(COALESCE(${table.data}->>'gpu_model', ${table.data}->>'item', ${table.data}->>'sku', '')) gin_trgm_ops`
  ),
  typeSearchIndex: index("gpu_pricing_type_trgm_idx").using(
    "gin",
    sql`(COALESCE(${table.data}->>'type', '')) gin_trgm_ops`
  ),
  gpuCountIndex: index("gpu_pricing_gpu_count_idx").on(
    sql`(CAST(${table.data}->>'gpu_count' AS NUMERIC))`
  ),
  vcpusIndex: index("gpu_pricing_vcpus_idx").on(
    sql`(CAST(${table.data}->>'vcpus' AS NUMERIC))`
  ),
  systemRamIndex: index("gpu_pricing_system_ram_idx").on(
    sql`(CAST(${table.data}->>'system_ram_gb' AS NUMERIC))`
  ),
  typeSortIndex: index("gpu_pricing_type_sort_idx").on(
    sql`(COALESCE(${table.data}->>'type', ''))`
  ),
  stableKeyIndex: index("gpu_pricing_stable_key_idx").on(table.stableKey),
}));

// User model favorites table - stores which AI models users have favorited
export const userModelFavorites = pgTable("user_model_favorites", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  modelId: text("model_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userModelUnique: uniqueIndex("user_model_unique").on(table.userId, table.modelId),
  // CRITICAL: Index on modelId for JOIN performance with aiModels
  modelIdIndex: index("user_model_favorites_model_id_idx").on(table.modelId),
}));
