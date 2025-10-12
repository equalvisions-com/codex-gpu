import { pgTable, text, timestamp, integer, jsonb, text as textType, uniqueIndex, index } from "drizzle-orm/pg-core";
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
  // Optimize queries by input modalities
  inputModalitiesIndex: index("ai_models_input_modalities_idx").on(table.inputModalities),
  // Full-text search on name and description
  nameDescIndex: index("ai_models_name_desc_idx").on(table.name, table.description),
  // GIN index for pricing queries
  pricingIndex: index("ai_models_pricing_idx").using("gin", table.pricing),
}));
