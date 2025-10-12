import type { AIModel, ModelScrapeResult } from '@/types/models';
import { providerParameters } from './provider-params';

/**
 * Scrapes AI models from OpenRouter API
 */
export class ModelsScraper {
  private readonly baseUrl = 'https://openrouter.ai/api/frontend/models/find?fmt=cards';

  private sanitizeSuffix(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  /**
   * Scrape all AI models from OpenRouter by hitting each provider's endpoint individually
   */
  async scrapeAll(limit?: number): Promise<ModelScrapeResult> {
    const startTime = Date.now();
    console.log(`[ModelsScraper] Starting AI models scrape${limit ? ` (limit: ${limit})` : ''}...`);

    try {
      const confirmedProviders = providerParameters;
      console.log(`[ModelsScraper] Found ${confirmedProviders.length} confirmed providers to scrape`);

      const allModels: AIModel[] = [];
      let totalFetched = 0;
      // Use global counters to ensure uniqueness across all providers
      const slugCounters: Record<string, number> = {};
      const idCounters: Record<string, number> = {};
      let globalSequence = 0; // Fallback sequence number for guaranteed uniqueness

      // Scrape each provider individually
      for (const { name, parameter } of confirmedProviders) {
        try {
          console.log(`[ModelsScraper] Scraping ${name} with parameter: ${parameter}`);

          const providerUrl = `${this.baseUrl}&providers=${parameter}`;
          const response = await fetch(providerUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; ModelsScraper/1.0)',
            },
          });

          if (!response.ok) {
            console.warn(`[ModelsScraper] Failed to fetch ${name}: HTTP ${response.status}`);
            continue;
          }

          const data = await response.json();

          if (!data?.data?.models) {
            console.warn(`[ModelsScraper] Invalid response structure for ${name}`);
            continue;
          }

          const modelsData = data.data.models;
          console.log(`[ModelsScraper] ${name}: fetched ${modelsData.length} models`);

          // Process models for this provider
          const processedModels: AIModel[] = modelsData.map((model: any, index: number) => {
            globalSequence++; // Increment for each model processed

            const modelProvider = model.endpoint?.provider_name || 'unknown';
            const originalSlug = model.slug || `unknown_${Date.now()}_${index}`;
            const slugBase = `${modelProvider.toLowerCase()}/${originalSlug}`;
            const variantRaw = typeof model.endpoint?.variant === 'string' ? model.endpoint.variant : null;
            const variantSuffix = variantRaw ? `--variant-${this.sanitizeSuffix(variantRaw)}` : '';

            // Create unique slug with provider prefix and variant
            const baseSlugKey = `${slugBase}${variantSuffix}`;
            const slugDuplicateIndex = slugCounters[baseSlugKey] ?? 0;
            slugCounters[baseSlugKey] = slugDuplicateIndex + 1;
            const slugDuplicateSuffix = slugDuplicateIndex > 0 ? `--dup-${slugDuplicateIndex}` : '';
            const uniqueSlug = `${baseSlugKey}${slugDuplicateSuffix}`;

            // Create unique ID - use original model.id if available, otherwise use slug
            // Add global sequence as final fallback for absolute uniqueness
            const idBase = model.id || slugBase;
            const baseIdKey = `${idBase}${variantSuffix}`;
            const idDuplicateIndex = idCounters[baseIdKey] ?? 0;
            idCounters[baseIdKey] = idDuplicateIndex + 1;
            const idDuplicateSuffix = idDuplicateIndex > 0 ? `--dup-${idDuplicateIndex}` : '';
            const uniqueId = `${baseIdKey}${idDuplicateSuffix}--seq-${globalSequence}`;

            return {
              id: uniqueId,
              slug: uniqueSlug, // Now includes provider prefix for uniqueness
              name: model.name || null,
              shortName: model.short_name || null,
              author: model.author || null,
              description: model.description || null,
              modelVersionGroupId: model.model_version_group_id || null,
              contextLength: model.context_length || null,
              inputModalities: Array.isArray(model.input_modalities) ? model.input_modalities : [],
              outputModalities: Array.isArray(model.output_modalities) ? model.output_modalities : [],
              hasTextOutput: model.has_text_output ? 'true' : 'false',
              group: model.group || null,
              instructType: model.instruct_type || null,
              permaslug: model.permaslug || null,
              pricing: model.endpoint?.pricing || {},
              features: model.features || {},
              endpoint: model.endpoint || {},
              provider: modelProvider,
              scrapedAt: new Date().toISOString(),
            };
          });

          allModels.push(...processedModels);
          totalFetched += modelsData.length;

          // Apply limit if specified (for testing)
          if (limit && totalFetched >= limit) {
            break;
          }

        } catch (error) {
          console.error(`[ModelsScraper] Failed to scrape ${name}:`, error);
          continue; // Continue with next provider
        }
      }

      // Apply limit if specified (for testing)
      let finalModels = allModels;
      if (limit && limit > 0) {
        finalModels = allModels.slice(0, limit);
      }

      const sourceHash = this.generateHash(JSON.stringify(finalModels));
      const scrapedAt = new Date().toISOString();

      const duration = Date.now() - startTime;
      console.log(`[ModelsScraper] Scraped ${finalModels.length} AI models from ${confirmedProviders.length} providers in ${duration}ms`);

      return {
        models: finalModels,
        scrapedAt,
        sourceHash,
      };

    } catch (error) {
      console.error('[ModelsScraper] Failed to scrape AI models:', error);
      throw error;
    }
  }

  /**
   * Generate a simple hash for change detection
   */
  private generateHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
}

// Export singleton instance
export const modelsScraper = new ModelsScraper();
