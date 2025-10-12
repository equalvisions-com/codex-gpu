import { db } from '@/db/client';
import { aiModels } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import type { AIModel, ModelScrapeResult } from '@/types/models';

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
    return rows.map(row => ({
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
      scrapedAt: row.scrapedAt.toISOString(),
    }));
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

    return rows.map(row => ({
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
      scrapedAt: row.scrapedAt.toISOString(),
    }));
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
    return {
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
      scrapedAt: row.scrapedAt.toISOString(),
    };
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
}

// Export singleton instance
export const modelsCache = new ModelsCache();
