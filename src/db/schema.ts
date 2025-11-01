import { pgTable, text, timestamp, integer, jsonb, text as textType, uniqueIndex, index, doublePrecision } from "drizzle-orm/pg-core";
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
  // Optimize queries for getting all favorites for a user
  userIdIndex: index("user_favorites_user_id_idx").on(table.userId),
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
  mmlu: doublePrecision("mmlu"),

  // Complex nested data stored as JSONB
  pricing: jsonb("pricing"),
  features: jsonb("features"),
  endpoint: jsonb("endpoint"),

  // Metadata
  provider: text("provider").notNull(),
  scrapedAt: timestamp("scraped_at").defaultNow().notNull(),
}, (table) => ({
  // Optimize queries by provider
  providerIndex: index("ai_models_provider_idx").on(table.provider),
  // Optimize queries by slug (no longer unique - same model can be served by multiple providers)
  slugIndex: index("ai_models_slug_idx").on(table.slug),
  // Optimize queries by author (for filtering)
  authorIndex: index("ai_models_author_idx").on(table.author),
  // Optimize queries by context length (for range queries and sorting)
  contextLengthIndex: index("ai_models_context_length_idx").on(table.contextLength),
  // Optimize queries by MMLU score (for sorting)
  mmluIndex: index("ai_models_mmlu_idx").on(table.mmlu),
  // Optimize queries by input modalities
  inputModalitiesIndex: index("ai_models_input_modalities_idx").on(table.inputModalities),
  // Optimize queries by output modalities (complement to inputModalities)
  outputModalitiesIndex: index("ai_models_output_modalities_idx").on(table.outputModalities),
  // Full-text search on name and description
  nameDescIndex: index("ai_models_name_desc_idx").on(table.name, table.description),
  // Composite index for default sorting (provider, name)
  providerNameIndex: index("ai_models_provider_name_idx").on(table.provider, table.name),
  // GIN index for pricing queries
  pricingIndex: index("ai_models_pricing_idx").using("gin", table.pricing),
}));

// GPU Pricing table - stores scraped GPU pricing data (wiped on each scrape)
export const gpuPricing = pgTable("gpu_pricing", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  observedAt: timestamp("observed_at").notNull(),
  version: integer("version").notNull().default(1),
  sourceHash: text("source_hash"),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  providerIndex: index("gpu_pricing_provider_idx").on(table.provider),
  observedAtIndex: index("gpu_pricing_observed_at_idx").on(table.observedAt),
  // GIN index for JSONB queries (filtering, sorting on data fields)
  dataIndex: index("gpu_pricing_data_idx").using("gin", table.data),
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
  userIdIndex: index("user_model_favorites_user_id_idx").on(table.userId),
  // CRITICAL: Index on modelId for JOIN performance with aiModels
  modelIdIndex: index("user_model_favorites_model_id_idx").on(table.modelId),
}));
