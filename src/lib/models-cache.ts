import { db } from "@/db/client";
import { aiModels, userModelFavorites } from "@/db/schema";
import { eq, sql, inArray, and, or, ilike, between, asc, desc } from "drizzle-orm";
import type { AIModel, ModelScrapeResult } from "@/types/models";
import type { ModelsSearchParamsType } from "@/components/models-table/models-search-params";

// Import sort priorities from route file (shared constants)
const PROVIDER_SORT_PRIORITY: Record<string, number> = {
  'Azure': 1,
  'Google Vertex': 2,
  'Groq': 3,
  'Together': 4,
  'Fireworks': 5,
  'OpenAI': 6,
  'Anthropic': 7,
  'Google AI Studio': 8,
  'Amazon Bedrock': 9,
  'Mistral': 10,
  'Cohere': 11,
  'xAI': 12,
  'Meta': 13,
  'Perplexity': 14,
  'DeepSeek': 15,
  'Cerebras': 16,
  'SambaNova': 17,
  'DeepInfra': 18,
  'Cloudflare': 19,
  'NVIDIA': 20,
  'Alibaba': 21,
  'MoonshotAI': 22,
  'BaseTen': 23,
  'Nebius': 24,
  'Crusoe': 25,
  'Friendli': 26,
  'Hyperbolic': 27,
  'MiniMax': 28,
  'AI21': 29,
  'SiliconFlow': 30,
  'Novita': 31,
  'Inflection': 32,
  'Venice': 33,
  'Chutes': 34,
  'Z.AI': 35,
  'Weights and Biases': 36,
  'Phala': 37,
  'AtlasCloud': 38,
  'Targon': 39,
  'Parasail': 40,
  'NCompass': 41,
  'Inception': 42,
  'Relace': 43,
  'Morph': 44,
  'Infermatic': 45,
  'AionLabs': 46,
  'Mancer': 47,
  'NextBit': 48,
  'Liquid': 49,
  'OpenInference': 50,
  'GMICloud': 51,
  'Switchpoint': 52,
  'Featherless': 53,
  'InferenceNet': 54,
};

const AUTHOR_SORT_PRIORITY: Record<string, number> = {
  'OpenAI': 1,
  'Anthropic': 2,
  'xAI': 3,
  'Google': 4,
  'Meta': 5,
  'Perplexity': 6,
  'DeepSeek': 7,
  'Z.AI': 8,
  'Qwen': 9,
  'Mistral': 10,
  'Cohere': 11,
  'MoonshotAI': 12,
  'NVIDIA': 13,
  'Microsoft': 14,
  'Amazon': 15,
  'Alibaba': 16,
  'Baidu': 17,
  'Tencent': 18,
  'ByteDance': 19,
  'AI21': 20,
  'Inflection': 21,
  'Meituan': 22,
  'AionLabs': 23,
  'Arcee AI': 24,
  'AllenAI': 25,
  'ArliAI': 26,
  'Liquid': 27,
  'Morph': 28,
  'inclusionAI': 29,
  'Relace': 30,
  'Inception': 31,
  'StepFun': 32,
  'Switchpoint': 33,
  'Nous Research': 34,
  'EleutherAI': 35,
  'NeverSleep': 36,
  'Gryphe': 37,
  'Cognitive Computations': 38,
  'Deep Cogito': 39,
  'Anthracite': 40,
  'MiniMax': 41,
  'AlfredPros': 42,
  'Mancer': 43,
  'Alpindale': 44,
  'THUDM': 45,
  'OpenGVLab': 46,
  'Sao10K': 47,
  'Undi': 48,
  'Shisa AI': 49,
  'rAIfle': 50,
  'Agentica': 51,
  'TNG': 52,
  'TheDrummer': 53,
};

const parseNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

type AIModelRow = typeof aiModels.$inferSelect;

const mapRowToAIModel = (row: AIModelRow): AIModel => ({
  id: row.id,
  slug: row.slug,
  name: row.name || undefined,
  shortName: row.shortName || undefined,
  author: row.author || undefined,
  description: row.description || undefined,
  modelVersionGroupId: row.modelVersionGroupId || undefined,
  contextLength: row.contextLength || undefined,
  inputModalities: row.inputModalities || [],
  outputModalities: row.outputModalities || [],
  hasTextOutput: row.hasTextOutput ?? "false",
  group: row.group || undefined,
  instructType: row.instructType || undefined,
  permaslug: row.permaslug || undefined,
  pricing: row.pricing as Record<string, any>,
  features: row.features as Record<string, any>,
  endpoint: row.endpoint as Record<string, any>,
  provider: row.provider,
  mmlu: parseNullableNumber(row.mmlu),
  scrapedAt: row.scrapedAt.toISOString(),
});

function buildModelFilterConditions(search: ModelsSearchParamsType) {
  const conditions: any[] = [];

  if (search.provider && search.provider.length > 0) {
    conditions.push(inArray(aiModels.provider, search.provider));
  }

  if (search.author && search.author.length > 0) {
    conditions.push(inArray(aiModels.author, search.author));
  }

  if (
    search.contextLength &&
    Array.isArray(search.contextLength) &&
    search.contextLength.length === 2
  ) {
    const [min, max] = search.contextLength;
    if (max >= 1000000) {
      conditions.push(sql`${aiModels.contextLength} >= ${min}`);
    } else {
      conditions.push(
        and(sql`${aiModels.contextLength} >= ${min}`, sql`${aiModels.contextLength} <= ${max}`)!,
      );
    }
  }

  if (search.inputPrice && Array.isArray(search.inputPrice) && search.inputPrice.length === 2) {
    const [min, max] = search.inputPrice;
    const minPerToken = (min ?? 0) / 1_000_000;
    const maxPerToken = (max ?? 0) / 1_000_000;
    conditions.push(
      sql`CAST(${aiModels.pricing}->>'prompt' AS NUMERIC) BETWEEN ${minPerToken} AND ${maxPerToken}`,
    );
  }

  if (search.outputPrice && Array.isArray(search.outputPrice) && search.outputPrice.length === 2) {
    const [min, max] = search.outputPrice;
    conditions.push(
      sql`CAST(${aiModels.pricing}->>'completion' AS NUMERIC) BETWEEN ${min} AND ${max}`,
    );
  }

  if (search.name) {
    conditions.push(ilike(aiModels.name, `%${search.name}%`));
  }

  if (search.description) {
    conditions.push(ilike(aiModels.description, `%${search.description}%`));
  }

  if (search.modalities && search.modalities.length > 0) {
    const directionEntries = new Map<string, "input" | "output" | "both">();
    (search.modalityDirections ?? []).forEach((entry) => {
      const [modality, direction] = entry.split(":");
      if (!modality) return;
      if (direction === "input" || direction === "output") {
        directionEntries.set(modality, direction);
      }
    });

    const modalityConditions = search.modalities.map((modality) => {
      const direction = directionEntries.get(modality) ?? "input";
      if (direction === "input") {
        return sql`${modality} = ANY(${aiModels.inputModalities})`;
      }
      if (direction === "output") {
        return sql`${modality} = ANY(${aiModels.outputModalities})`;
      }
      return or(
        sql`${modality} = ANY(${aiModels.inputModalities})`,
        sql`${modality} = ANY(${aiModels.outputModalities})`,
      )!;
    });

    if (modalityConditions.length === 1) {
      conditions.push(modalityConditions[0]);
    } else if (modalityConditions.length > 1) {
      conditions.push(and(...modalityConditions)!);
    }
  }

  if (search.search) {
    const searchTerm = `%${search.search}%`;
    conditions.push(
      or(
        ilike(aiModels.name, searchTerm),
        ilike(aiModels.description, searchTerm),
        ilike(aiModels.provider, searchTerm),
        ilike(aiModels.author, searchTerm),
      )!,
    );
  }

  return conditions;
}

export class ModelsCache {
  /**
   * Store AI models data by wiping the table and inserting fresh data
   */
  async storeModels(result: ModelScrapeResult): Promise<number> {
    const { models } = result;

    console.log(`[ModelsCache] Storing ${models.length} AI models (keeping all provider instances)...`);

    // Wipe the table (as requested - no historical data)
    await db.delete(aiModels);

    // Insert new models - handle in very small batches to avoid parameter limits with large JSON
    let stored = 0;
    const batchSize = 1; // Single models to avoid PostgreSQL parameter limits with large JSONB data

    if (models.length > 0) {
      for (let i = 0; i < models.length; i += batchSize) {
        const batch = models.slice(i, i + batchSize);
        const values = batch.map(model => ({
          id: model.id,
          slug: model.slug,
          name: model.name,
          shortName: model.shortName,
          author: model.author,
          description: model.description,
          modelVersionGroupId: model.modelVersionGroupId,
          contextLength: model.contextLength,
          inputModalities: model.inputModalities,
          outputModalities: model.outputModalities,
          hasTextOutput: model.hasTextOutput,
          group: model.group,
          instructType: model.instructType,
          permaslug: model.permaslug,
          pricing: model.pricing,
          features: model.features,
          endpoint: model.endpoint,
          provider: model.provider,
          mmlu: model.mmlu ?? null,
          scrapedAt: new Date(model.scrapedAt),
        }));

        try {
          await db.insert(aiModels).values(values);
          stored += batch.length;
          console.log(`[ModelsCache] Stored model ${i + 1}/${models.length}: ${batch[0].slug} (${batch[0].provider})`);
        } catch (error: any) {
          console.error(`[ModelsCache] Failed to store model ${i + 1}: ${batch[0].slug} (${batch[0].provider}) - ${error.message}`);
          // Continue with next model instead of failing
        }
      }
    }

    console.log(`[ModelsCache] Successfully stored ${stored}/${models.length} AI models`);
    return stored;
  }

  /**
   * Get all AI models
   */
  async getAllModels(): Promise<AIModel[]> {
    const rows = await db.select().from(aiModels).orderBy(aiModels.name);
    return rows.map(mapRowToAIModel);
  }

  /**
   * Get models for a specific provider
   */
  async getModelsByProvider(provider: string): Promise<AIModel[]> {
    const rows = await db
      .select()
      .from(aiModels)
      .where(eq(aiModels.provider, provider))
      .orderBy(aiModels.name);

    return rows.map(mapRowToAIModel);
  }

  /**
   * Get a specific model by slug
   */
  async getModelBySlug(slug: string): Promise<AIModel | null> {
    const rows = await db
      .select()
      .from(aiModels)
      .where(eq(aiModels.slug, slug))
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0];
    return mapRowToAIModel(row);
  }

  async getModelsByIds(ids: string[]): Promise<AIModel[]> {
    if (ids.length === 0) {
      return [];
    }

    const uniqueIds = Array.from(new Set(ids));
    const rows = await db
      .select()
      .from(aiModels)
      .where(inArray(aiModels.id, uniqueIds));

    return rows.map(mapRowToAIModel);
  }

  /**
   * Get all available providers
   */
  async getAvailableProviders(): Promise<string[]> {
    const rows = await db
      .select({ provider: aiModels.provider })
      .from(aiModels)
      .groupBy(aiModels.provider);

    return rows.map(row => row.provider);
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalModels: number;
    providers: string[];
    lastScrapedAt?: string;
  }> {
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(aiModels);

    const providers = await this.getAvailableProviders();

    const [latestResult] = await db
      .select({ scrapedAt: sql<string>`max(scraped_at)` })
      .from(aiModels);

    return {
      totalModels: totalResult?.count || 0,
      providers,
      lastScrapedAt: latestResult?.scrapedAt,
    };
  }

  /**
   * Clear all models (useful for testing)
   */
  async clearAllModels(): Promise<number> {
    const deleted = await db.delete(aiModels).returning({ id: aiModels.id });
    console.log(`[ModelsCache] Cleared ${deleted.length} models`);
    return deleted.length;
  }

  /**
   * Get models with database-level filtering, sorting, and pagination
   * This follows TanStack Table's recommended pattern for server-side pagination
   * 
   * @param search - Search parameters including filters, sort, and pagination
   * @returns Object containing paginated data and total count
   */
  async getModelsFiltered(
    search: ModelsSearchParamsType
  ): Promise<{ data: AIModel[]; totalCount: number; filterCount: number }> {
    const conditions = buildModelFilterConditions(search);
    const whereClause = conditions.length > 0 ? and(...conditions)! : undefined;

    // Get total count (for pagination)
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(aiModels)
      .where(whereClause);

    const filterCount = Number(countResult?.count || 0);

    // Build ORDER BY clause
    let orderByClause;
    if (search.sort) {
      const { id, desc: isDesc } = search.sort;
      const direction = isDesc ? desc : asc;

      switch (id) {
        case 'provider':
          orderByClause = direction(aiModels.provider);
          break;
        case 'name':
          orderByClause = direction(aiModels.name);
          break;
        case 'contextLength':
          orderByClause = direction(aiModels.contextLength);
          break;
        case 'inputPrice':
          // JSONB field sorting
          orderByClause = sql`CAST(${aiModels.pricing}->>'prompt' AS NUMERIC) ${isDesc ? sql.raw('DESC') : sql.raw('ASC')}`;
          break;
        case 'outputPrice':
          // JSONB field sorting
          orderByClause = sql`CAST(${aiModels.pricing}->>'completion' AS NUMERIC) ${isDesc ? sql.raw('DESC') : sql.raw('ASC')}`;
          break;
        case 'mmlu':
          orderByClause = direction(aiModels.mmlu);
          break;
        default:
          // Default: sort by provider
          orderByClause = asc(aiModels.provider);
      }
    } else {
      // Default: sort by provider
      orderByClause = asc(aiModels.provider);
    }

    // Apply pagination
    const cursor = typeof search.cursor === 'number' && search.cursor >= 0 ? search.cursor : 0;
    const size = Math.min(Math.max(1, search.size ?? 50), 200); // Clamp size between 1 and 200

    // Execute query with filtering, sorting, and pagination
    const rows = await db
      .select()
      .from(aiModels)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(size)
      .offset(cursor);

    return {
      data: rows.map(mapRowToAIModel),
      totalCount: filterCount, // Total matching filters
      filterCount: filterCount, // Same as totalCount (no separate unfiltered count needed)
    };
  }

  /**
   * Get favorite models with database-level filtering, sorting, and pagination
   * This follows TanStack Table's recommended pattern for server-side pagination
   * Uses JOIN to combine userModelFavorites with aiModels
   * 
   * @param userId - User ID to filter favorites
   * @param search - Search parameters including sort and pagination
   * @returns Object containing paginated data and total count
   */
  async getFavoriteModelsFiltered(
    userId: string,
    search: ModelsSearchParamsType
  ): Promise<{ data: AIModel[]; totalCount: number; filterCount: number }> {
    const filterConditions = buildModelFilterConditions(search);

    // Build ORDER BY clause (same logic as getModelsFiltered)
    let orderByClause;
    if (search.sort) {
      const { id, desc: isDesc } = search.sort;
      const direction = isDesc ? desc : asc;

      switch (id) {
        case 'provider':
          orderByClause = direction(aiModels.provider);
          break;
        case 'name':
          orderByClause = direction(aiModels.name);
          break;
        case 'contextLength':
          orderByClause = direction(aiModels.contextLength);
          break;
        case 'inputPrice':
          // JSONB field sorting
          orderByClause = sql`CAST(${aiModels.pricing}->>'prompt' AS NUMERIC) ${isDesc ? sql.raw('DESC') : sql.raw('ASC')}`;
          break;
        case 'outputPrice':
          // JSONB field sorting
          orderByClause = sql`CAST(${aiModels.pricing}->>'completion' AS NUMERIC) ${isDesc ? sql.raw('DESC') : sql.raw('ASC')}`;
          break;
        case 'mmlu':
          orderByClause = direction(aiModels.mmlu);
          break;
        default:
          // Default: sort by provider
          orderByClause = asc(aiModels.provider);
      }
    } else {
      // Default: sort by provider
      orderByClause = asc(aiModels.provider);
    }

    // Apply pagination
    const cursor = typeof search.cursor === 'number' && search.cursor >= 0 ? search.cursor : 0;
    const size = Math.min(Math.max(1, search.size ?? 50), 200); // Clamp size between 1 and 200

    // Get total count of favorites for this user (without filters)
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(userModelFavorites)
      .where(eq(userModelFavorites.userId, userId));

    const totalCount = Number(countResult?.count || 0);

    const baseCondition = eq(userModelFavorites.userId, userId);
    const whereClause =
      filterConditions.length > 0 ? and(baseCondition, ...filterConditions)! : baseCondition;

    const [filteredCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(userModelFavorites)
      .innerJoin(aiModels, eq(userModelFavorites.modelId, aiModels.id))
      .where(whereClause);

    const filterCount = Number(filteredCountResult?.count || 0);

    if (filterCount === 0) {
      return {
        data: [],
        totalCount,
        filterCount: 0,
      };
    }

    // Execute query with JOIN, sorting, and pagination at database level
    // JOIN userModelFavorites with aiModels, filter by userId, sort, and paginate
    const rows = await db
      .select({
        id: aiModels.id,
        slug: aiModels.slug,
        name: aiModels.name,
        shortName: aiModels.shortName,
        author: aiModels.author,
        description: aiModels.description,
        modelVersionGroupId: aiModels.modelVersionGroupId,
        contextLength: aiModels.contextLength,
        inputModalities: aiModels.inputModalities,
        outputModalities: aiModels.outputModalities,
        hasTextOutput: aiModels.hasTextOutput,
        group: aiModels.group,
        instructType: aiModels.instructType,
        permaslug: aiModels.permaslug,
        pricing: aiModels.pricing,
        features: aiModels.features,
        endpoint: aiModels.endpoint,
        provider: aiModels.provider,
        mmlu: aiModels.mmlu,
        scrapedAt: aiModels.scrapedAt,
      })
      .from(userModelFavorites)
      .innerJoin(aiModels, eq(userModelFavorites.modelId, aiModels.id))
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(size)
      .offset(cursor);

    return {
      data: rows.map(mapRowToAIModel),
      totalCount,
      filterCount,
    };
  }

  /**
   * Generate facets directly from database using SQL aggregations
   * This avoids loading all models into memory (2MB cache limit issue)
   * Returns facet data: provider, author, modalities, name counts
   */
  async getModelsFacets(): Promise<{
    provider: { rows: { value: string; total: number }[]; total: number };
    author: { rows: { value: string; total: number }[]; total: number };
    modalities: { rows: { value: string; total: number }[]; total: number };
    name: { rows: { value: string; total: number }[]; total: number };
  }> {
    // Get total count
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(aiModels);
    const totalCount = Number(totalResult?.count || 0);

    // Provider facet (GROUP BY provider)
    const providerRows = await db
      .select({
        provider: aiModels.provider,
        count: sql<number>`count(*)`,
      })
      .from(aiModels)
      .groupBy(aiModels.provider);

    const providerFacet = {
      rows: providerRows
        .map((r) => ({ value: r.provider, total: Number(r.count) }))
        .sort((a, b) => {
          const aPriority = PROVIDER_SORT_PRIORITY[a.value] || 999;
          const bPriority = PROVIDER_SORT_PRIORITY[b.value] || 999;
          if (aPriority !== bPriority) return aPriority - bPriority;
          return a.value.localeCompare(b.value);
        }),
      total: totalCount,
    };

    // Author facet (GROUP BY author, exclude nulls)
    const authorRows = await db
      .select({
        author: aiModels.author,
        count: sql<number>`count(*)`,
      })
      .from(aiModels)
      .where(sql`${aiModels.author} IS NOT NULL`)
      .groupBy(aiModels.author);

    const authorFacet = {
      rows: authorRows
        .map((r) => ({ value: r.author || '', total: Number(r.count) }))
        .sort((a, b) => {
          const aPriority = AUTHOR_SORT_PRIORITY[a.value] || 999;
          const bPriority = AUTHOR_SORT_PRIORITY[b.value] || 999;
          if (aPriority !== bPriority) return aPriority - bPriority;
          return a.value.localeCompare(b.value);
        }),
      total: totalCount,
    };

    // Modalities facet (need to unnest arrays and count)
    // This is more complex - we need to unnest both input and output modalities
    // Use a subquery with UNION ALL to combine input and output modalities
    const modalityRows = await db.execute(sql`
      SELECT modality, COUNT(*) as count
      FROM (
        SELECT unnest(input_modalities) as modality FROM ${aiModels}
        UNION ALL
        SELECT unnest(output_modalities) as modality FROM ${aiModels}
      ) AS all_modalities
      WHERE modality IS NOT NULL
      GROUP BY modality
    `);

    const modalityFacet = {
      rows: (modalityRows as unknown as Array<{ modality: string; count: string | number }>)
        .map((r) => ({ value: r.modality, total: Number(r.count) }))
        .sort((a, b) => a.value.localeCompare(b.value)),
      total: totalCount,
    };

    // Name facet (top 20 most common names)
    const nameRows = await db
      .select({
        name: aiModels.name,
        count: sql<number>`count(*)`,
      })
      .from(aiModels)
      .where(sql`${aiModels.name} IS NOT NULL`)
      .groupBy(aiModels.name)
      .orderBy(sql`count(*) DESC`)
      .limit(20);

    const nameFacet = {
      rows: nameRows.map((r) => ({ value: r.name || '', total: Number(r.count) })),
      total: totalCount,
    };

    return {
      provider: providerFacet,
      author: authorFacet,
      modalities: modalityFacet,
      name: nameFacet,
    };
  }
}

// Export singleton instance
export const modelsCache = new ModelsCache();
