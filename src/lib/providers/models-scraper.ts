import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { AIModel, ModelScrapeResult } from '@/types/models';
import { providerParameters } from './provider-params';

const AUTHOR_MAP: Record<string, string> = {
  'x-ai': 'xAI',
  'agentica-org': 'Agentica',
  'anthropic': 'Anthropic',
  'google': 'Google',
  'meta-llama': 'Meta',
  'microsoft': 'Microsoft',
  'nvidia': 'NVIDIA',
  'openai': 'OpenAI',
  'perplexity': 'Perplexity',
  'ai21': 'AI21',
  'aion-labs': 'AionLabs',
  'alfredpros': 'AlfredPros',
  'allenai': 'AllenAI',
  'amazon': 'Amazon',
  'arcee-ai': 'Arcee AI',
  'arliai': 'ArliAI',
  'baidu': 'Baidu',
  'bytedance': 'ByteDance',
  'deepcogito': 'Deep Cogito',
  'deepseek': 'DeepSeek',
  'cohere': 'Cohere',
  'cognitivecomputations': 'Cognitive Computations',
  'eleutherai': 'EleutherAI',
  'alpindale': 'Alpindale',
  'inception': 'Inception',
  'inclusionai': 'inclusionAI',
  'inflection': 'Inflection',
  'liquid': 'Liquid',
  'anthracite-org': 'Anthracite',
  'mancer': 'Mancer',
  'meituan': 'Meituan',
  'minimax': 'MiniMax',
  'mistralai': 'Mistral',
  'moonshotai': 'MoonshotAI',
  'morph': 'Morph',
  'gryphe': 'Gryphe',
  'neversleep': 'NeverSleep',
  'nousresearch': 'Nous Research',
  'opengvlab': 'OpenGVLab',
  'qwen': 'Qwen',
  'relace': 'Relace',
  'undi95': 'Undi',
  'sao10k': 'Sao10K',
  'shisa-ai': 'Shisa AI',
  'raifle': 'rAIfle',
  'stepfun-ai': 'StepFun',
  'switchpoint': 'Switchpoint',
  'tencent': 'Tencent',
  'thedrummer': 'TheDrummer',
  'thudm': 'THUDM',
  'tngtech': 'TNG',
  'alibaba': 'Alibaba',
  'z-ai': 'Z.AI',
};

const PROVIDER_MAP: Record<string, string> = {
  'WandB': 'Weights and Biases',
  'Google': 'Google Vertex',
  'Mancer 2': 'Mancer',
  'Minimax': 'MiniMax',
  'Moonshot AI': 'MoonshotAI',
  'Nvidia': 'NVIDIA',
};

interface BenchmarkModel {
  name: string;
  slug?: string;
  evaluations?: {
    mmlu_pro?: number | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface BenchmarkDataset {
  data?: BenchmarkModel[];
}

/**
 * Scrapes AI models from OpenRouter API
 */
export class ModelsScraper {
  private readonly baseUrl = 'https://openrouter.ai/api/frontend/models/find?fmt=cards';
  private benchmarkLookupPromise?: Promise<Map<string, BenchmarkModel>>;

  private sanitizeSuffix(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  private transformProviderName(provider: string): string {
    // Transform provider names during ingestion using lookup map
    return PROVIDER_MAP[provider] ?? provider;
  }

  private transformAuthorName(author: string): string {
    // Transform author names during ingestion using lookup map
    return AUTHOR_MAP[author] ?? author;
  }

  private normalizeName(value?: string | null): string | null {
    if (!value) {
      return null;
    }

    const cleaned = value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');

    return cleaned.length > 0 ? cleaned : null;
  }

  private cleanShortName(value?: string | null): string | null {
    if (!value) {
      return null;
    }

    let cleaned = value.trim();

    // Convert "ChatGPT-" to "GPT-" (case-insensitive)
    cleaned = cleaned.replace(/ChatGPT-/gi, 'GPT-');

    // Strip only " (free)" pattern (case-insensitive)
    cleaned = cleaned.replace(/\s*\(free\)/gi, '').trim();

    // Strip only " (exacto)" pattern (case-insensitive)
    cleaned = cleaned.replace(/\s*\(exacto\)/gi, '').trim();

    // Convert only " (thinking)" to " Thinking" (case-insensitive, capitalize result)
    cleaned = cleaned.replace(/\s*\(thinking\)/gi, ' Thinking').trim();

    return cleaned.length > 0 ? cleaned : null;
  }

  private generatePermutations(words: string[]): string[] {
    if (words.length < 3 || words.length > 4) {
      return [];
    }

    const results: string[][] = [];
    const used = Array(words.length).fill(false);
    const current: string[] = [];

    const backtrack = () => {
      if (current.length === words.length) {
        results.push([...current]);
        return;
      }

      for (let i = 0; i < words.length; i++) {
        if (used[i]) continue;
        used[i] = true;
        current.push(words[i]);
        backtrack();
        current.pop();
        used[i] = false;
      }
    };

    backtrack();

    return results.map(permutation => permutation.join(' '));
  }

  private async getBenchmarkLookup(): Promise<Map<string, BenchmarkModel>> {
    if (!this.benchmarkLookupPromise) {
      this.benchmarkLookupPromise = this.loadBenchmarkLookup();
    }

    return this.benchmarkLookupPromise;
  }

  private async loadBenchmarkLookup(): Promise<Map<string, BenchmarkModel>> {
    try {
      const filePath = path.join(process.cwd(), 'public', 'model-scores.json');
      const content = await readFile(filePath, 'utf8');
      const parsed = JSON.parse(content) as BenchmarkDataset;

      if (!parsed?.data || !Array.isArray(parsed.data)) {
        console.warn('[ModelsScraper] Benchmark dataset missing or malformed');
        return new Map();
      }

      const lookup = new Map<string, BenchmarkModel>();
      for (const model of parsed.data) {
        const normalizedName = this.normalizeName(model.name);
        if (normalizedName) {
          lookup.set(normalizedName, model);
        }

        if (model.slug) {
          const normalizedSlug = this.normalizeName(model.slug);
          if (normalizedSlug) {
            lookup.set(normalizedSlug, model);
          }
        }
      }

      console.log(`[ModelsScraper] Loaded ${lookup.size} benchmark entries for MMLU matching`);
      return lookup;
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        console.warn('[ModelsScraper] Benchmark dataset public/model-scores.json not found; skipping MMLU matching');
        return new Map();
      }

      console.error('[ModelsScraper] Failed to load benchmark dataset for MMLU matching:', error);
      return new Map();
    }
  }

  private findMmluScore(
    apiModel: any,
    benchmarkLookup: Map<string, BenchmarkModel>
  ): number | null {
    if (benchmarkLookup.size === 0) {
      return null;
    }

    const candidates = new Set<string>();

    const normalizedShortName = this.normalizeName(apiModel.short_name);
    if (normalizedShortName) {
      candidates.add(normalizedShortName);
      const words = normalizedShortName.split(' ');
      for (const permutation of this.generatePermutations(words)) {
        candidates.add(permutation);
      }
    }

    const normalizedName = this.normalizeName(apiModel.name);
    if (normalizedName) {
      candidates.add(normalizedName);
    }

    const endpointSlug = this.normalizeName(apiModel.slug);
    if (endpointSlug) {
      candidates.add(endpointSlug);
    }

    for (const candidate of candidates) {
      const benchmark = benchmarkLookup.get(candidate);
      if (benchmark?.evaluations?.mmlu_pro != null) {
        return typeof benchmark.evaluations.mmlu_pro === 'number'
          ? benchmark.evaluations.mmlu_pro
          : Number(benchmark.evaluations.mmlu_pro);
      }
    }

    return null;
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
      const benchmarkLookup = await this.getBenchmarkLookup();

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
            const mmluScore = this.findMmluScore(model, benchmarkLookup);
            const supportedParameters = Array.isArray(model.endpoint?.supported_parameters)
              ? model.endpoint.supported_parameters.filter(
                  (parameter: unknown): parameter is string => typeof parameter === 'string',
                )
              : [];

            // Extract max_completion_tokens from endpoint
            const extractMaxCompletionTokens = (endpoint: any): number | null => {
              if (!endpoint || typeof endpoint !== "object") return null;
              
              // Try top-level first
              if (typeof endpoint.max_completion_tokens === "number") {
                return endpoint.max_completion_tokens;
              }
              
              // Try nested in model object
              if (endpoint.model && typeof endpoint.model === "object") {
                const modelValue = endpoint.model.max_completion_tokens;
                if (typeof modelValue === "number") {
                  return modelValue;
                }
              }
              
              return null;
            };
            const maxCompletionTokens = extractMaxCompletionTokens(model.endpoint);

            const rawProvider = model.endpoint?.provider_name || 'unknown';
            const modelProvider = this.transformProviderName(rawProvider);
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
              shortName: this.cleanShortName(model.short_name),
              author: model.author ? this.transformAuthorName(model.author) : null,
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
              provider: modelProvider,
              mmlu: mmluScore ?? null,
              maxCompletionTokens: maxCompletionTokens ?? null,
              supportedParameters,
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
