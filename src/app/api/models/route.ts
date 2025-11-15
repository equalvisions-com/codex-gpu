import type { ModelsInfiniteQueryResponse, ModelsLogsMeta } from "@/components/models-table/models-query-options";
import type { ModelsColumnSchema } from "@/components/models-table/models-schema";
import { modelsSearchParamsCache } from "@/components/models-table/models-search-params";
import type { ModelsSearchParamsType } from "@/components/models-table/models-search-params";
import { modelsCache } from "@/lib/models-cache";
import { logger } from "@/lib/logger";
import type { AIModel } from "@/types/models";
import { unstable_cache } from "next/cache";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

type ModalitiesDirection = "input" | "output";

// Custom sorting priority for author filter options
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

// Custom sorting priority for provider filter options
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

// AI Model row interface for filtering/sorting system
interface ModelsRowWithId extends AIModel {
  uuid: string;
}

// Simple filtering function for AI models
function filterModelsData(data: ModelsRowWithId[], search: ModelsSearchParamsType): ModelsRowWithId[] {
  return data.filter((row) => {
    // Provider filter
    if (search.provider && search.provider.length > 0 && !search.provider.includes(row.provider)) {
      return false;
    }

    // Author filter
    if (search.author && search.author.length > 0 && !search.author.includes(row.author || '')) {
      return false;
    }

    // Context length filter (range filter)
    if (search.contextLength && Array.isArray(search.contextLength) && search.contextLength.length === 2) {
      const [min, max] = search.contextLength;
      const contextLength = row.contextLength;
      if (contextLength !== null && contextLength !== undefined) {
        // If max is at the slider maximum (1M), treat it as "1M or higher"
        const effectiveMax = max >= 1000000 ? Infinity : max;
        if (contextLength < min || contextLength > effectiveMax) {
          return false;
        }
      }
    }

    // Input price filter (range filter)
    if (search.inputPrice && Array.isArray(search.inputPrice) && search.inputPrice.length === 2) {
      const [min, max] = search.inputPrice;
      const minPerToken = (min ?? 0) / 1_000_000;
      const maxPerToken = (max ?? 0) / 1_000_000;
      const inputPrice = row.pricing?.prompt;
      if (inputPrice !== null && inputPrice !== undefined) {
        if (inputPrice < minPerToken || inputPrice > maxPerToken) {
          return false;
        }
      }
    }

    // Output price filter (range filter)
    if (search.outputPrice && Array.isArray(search.outputPrice) && search.outputPrice.length === 2) {
      const [min, max] = search.outputPrice;
      const outputPrice = row.pricing?.completion;
      if (outputPrice !== null && outputPrice !== undefined) {
        if (outputPrice < min || outputPrice > max) {
          return false;
        }
      }
    }

    // Name filter (partial match)
    if (search.name && !row.name?.toLowerCase().includes(search.name.toLowerCase())) {
      return false;
    }

    // Description filter (partial match)
    if (search.description && !row.description?.toLowerCase().includes(search.description.toLowerCase())) {
      return false;
    }

    // Modalities filter (direction configurable per modality)
    if (search.modalities && search.modalities.length > 0) {
      const directionEntries = new Map<string, "input" | "output" | "both">();
      (search.modalityDirections ?? []).forEach((entry) => {
        const [modality, direction] = entry.split(":");
        if (!modality) return;
        if (direction === "input" || direction === "output") {
          directionEntries.set(modality, direction);
        }
      });

      const hasAllModalities = search.modalities.every((modality) => {
        const direction = directionEntries.get(modality) ?? "input";
        if (direction === "input") {
          return (row.inputModalities || []).includes(modality);
        }
        return (row.outputModalities || []).includes(modality);
      });

      if (!hasAllModalities) {
        return false;
      }
    }

    // Search filter (limited to visible table columns + parameters)
    if (search.search) {
      const searchTerm = search.search.toLowerCase();
      const pricing = row.pricing ?? {};
      const promptPrice = pricing.prompt;
      const outputPrice = pricing.completion;
      const context = row.contextLength;
      const maxOutput = row.maxCompletionTokens;
      const mmluScore = row.mmlu;
      const textParts = [
        row.provider,
        row.shortName ?? row.name,
        row.author,
        parameters.join(" "),
      ];

      const numericParts = [
        promptPrice != null ? promptPrice.toString() : null,
        outputPrice != null ? outputPrice.toString() : null,
        context != null ? context.toString() : null,
        maxOutput != null ? maxOutput.toString() : null,
        mmluScore != null ? (mmluScore * 100).toFixed(2) : null,
      ];

      const searchableText = [...textParts, ...numericParts]
        .filter((part) => typeof part === "string" && part.length > 0)
        .join(" ")
        .toLowerCase();

      if (!searchableText.includes(searchTerm)) return false;
    }

    return true;
  });
}

// Simple sorting function for AI models
function sortModelsData(data: ModelsRowWithId[], sortParam?: { id: string; desc: boolean }): ModelsRowWithId[] {
  if (!sortParam) {
    return [...data].sort((a, b) => (a.provider || '').localeCompare(b.provider || ''));
  }

  return [...data].sort((a, b) => {
    const { id, desc } = sortParam;

    let aValue: any;
    let bValue: any;

    switch (id) {
      case 'provider':
        aValue = a.provider || '';
        bValue = b.provider || '';
        break;
      case 'name': {
        const normalize = (value?: string | null) => (value ? value.trim().toLocaleLowerCase() : '');
        aValue = normalize(a.shortName);
        bValue = normalize(b.shortName);
        break;
      }
      case 'contextLength':
        aValue = a.contextLength || 0;
        bValue = b.contextLength || 0;
        break;
      case 'inputPrice':
        aValue = a.pricing?.prompt || 0;
        bValue = b.pricing?.prompt || 0;
        break;
      case 'outputPrice':
        aValue = a.pricing?.completion || 0;
        bValue = b.pricing?.completion || 0;
        break;
      case 'mmlu':
        aValue = typeof a.mmlu === 'number' ? a.mmlu : -Infinity;
        bValue = typeof b.mmlu === 'number' ? b.mmlu : -Infinity;
        break;
      case 'maxCompletionTokens':
        aValue = typeof a.maxCompletionTokens === 'number' ? a.maxCompletionTokens : -Infinity;
        bValue = typeof b.maxCompletionTokens === 'number' ? b.maxCompletionTokens : -Infinity;
        break;
      default:
        aValue = a[id as keyof AIModel] || '';
        bValue = b[id as keyof AIModel] || '';
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const comparison = aValue.localeCompare(bValue);
      return desc ? -comparison : comparison;
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return desc ? bValue - aValue : aValue - bValue;
    }

    return 0;
  });
}

// Simple facets generation for AI models
function generateModelsFacets(data: ModelsRowWithId[]): Record<string, { rows: { value: any; total: number }[]; total: number }> {
  const facets: Record<string, { rows: { value: any; total: number }[]; total: number }> = {};

  // Provider facet
  const providerCounts: Record<string, number> = {};
  data.forEach(row => {
    const provider = row.provider;
    providerCounts[provider] = (providerCounts[provider] || 0) + 1;
  });
  facets.provider = {
    rows: Object.entries(providerCounts)
      .map(([value, total]) => ({ value, total }))
      .sort((a, b) => {
        const aPriority = PROVIDER_SORT_PRIORITY[a.value] || 999;
        const bPriority = PROVIDER_SORT_PRIORITY[b.value] || 999;

        // Sort by priority first, then alphabetically
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        return a.value.localeCompare(b.value);
      }),
    total: data.length
  };

  // Author facet
  const authorCounts: Record<string, number> = {};
  data.forEach(row => {
    if (row.author) {
      authorCounts[row.author] = (authorCounts[row.author] || 0) + 1;
    }
  });
  facets.author = {
    rows: Object.entries(authorCounts)
      .map(([value, total]) => ({ value, total }))
      .sort((a, b) => {
        const aPriority = AUTHOR_SORT_PRIORITY[a.value] || 999;
        const bPriority = AUTHOR_SORT_PRIORITY[b.value] || 999;

        // Sort by priority first, then alphabetically
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        return a.value.localeCompare(b.value);
      }),
    total: data.length
  };

  // Modalities facet (combined input/output)
  const modalityCounts: Record<string, number> = {};
  data.forEach((row) => {
    const combinedModalities = new Set([...(row.inputModalities || []), ...(row.outputModalities || [])]);
    combinedModalities.forEach((modality) => {
      if (!modality) return;
      modalityCounts[modality] = (modalityCounts[modality] || 0) + 1;
    });
  });
  facets.modalities = {
    rows: Object.entries(modalityCounts)
      .map(([value, total]) => ({ value, total }))
      .sort((a, b) => a.value.localeCompare(b.value)),
    total: data.length,
  };

  // Name facet (top 20 most common names)
  const nameCounts: Record<string, number> = {};
  data.forEach(row => {
    if (row.name) {
      nameCounts[row.name] = (nameCounts[row.name] || 0) + 1;
    }
  });
  const topNames = Object.entries(nameCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 20)
    .map(([value, total]) => ({ value, total }));
  facets.name = {
    rows: topNames,
    total: data.length
  };

  return facets;
}

// Cache facets generation (uses SQL aggregations, not full data load)
// This avoids the 2MB cache limit while still providing facet data
// Cache for 12 hours - data only changes when scraper runs, which invalidates cache
const getCachedFacets = unstable_cache(
  async () => {
    return await modelsCache.getModelsFacets();
  },
  ["models:facets"],
  {
    revalidate: 43200, // 12 hours (data only changes when scraper runs, cache invalidated on scrape)
    tags: ["models"],
  }
);

const CACHE_SIZE_LIMIT_BYTES = 2 * 1024 * 1024; // 2MB

const cryptoHash = (value: string) => createHash("sha256").update(value).digest("hex");

function hashModelSearchParams(search: ModelsSearchParamsType): string {
  const sortedEntries = Object.entries(search ?? {})
    .map(([key, value]) => [key, value] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  return cryptoHash(JSON.stringify(sortedEntries));
}

async function getCachedModelsFiltered(search: ModelsSearchParamsType) {
  const cacheFn = unstable_cache(
    async () => {
      const result = await modelsCache.getModelsFiltered(search);

      const estimatedSize = JSON.stringify(result).length;

      if (estimatedSize > CACHE_SIZE_LIMIT_BYTES) {
        console.warn("[getCachedModelsFiltered] Cache size limit exceeded, will fall back to direct DB query", {
          estimatedSizeBytes: estimatedSize,
          limitBytes: CACHE_SIZE_LIMIT_BYTES,
          rowCount: result.data.length,
          searchParams: { cursor: search.cursor, size: search.size, sort: search.sort },
        });

        throw new Error(`Cache size (${estimatedSize} bytes) exceeds limit (${CACHE_SIZE_LIMIT_BYTES} bytes)`);
      }

      return result;
    },
    ["models:filtered", hashModelSearchParams(search)],
    {
      revalidate: 43200,
      tags: ["models"],
    },
  );

  return cacheFn();
}

export async function GET(req: Request): Promise<Response> {
  try {
    // Note: using GET for simplicity; consider POST if query size grows
    const requestUrl = new URL(req.url);
    const _search: Map<string, string> = new Map();
    requestUrl.searchParams.forEach((value, key) => _search.set(key, value));

    const search: ModelsSearchParamsType = modelsSearchParamsCache.parse(Object.fromEntries(_search));
    const t1 = Date.now();

    // Fetch filtered, sorted, paginated data from database (TanStack Table best practice)
    // Cached server-side with 2min TTL to reduce DB load
    // This only loads the rows needed for the current page, not all rows
    // If cache fails (e.g., > 2MB), falls back to DB query gracefully
    let filteredModels: AIModel[];
    let totalCount: number;
    let filterCount: number;
    
    try {
      const result = await getCachedModelsFiltered(search);
      filteredModels = result.data;
      totalCount = result.totalCount;
      filterCount = result.filterCount;
    } catch (error) {
      // Fallback to direct DB query if cache fails (e.g., > 2MB or cache error)
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isSizeError = errorMessage.includes("2MB") || errorMessage.includes("size") || errorMessage.includes("cache");
      
      if (isSizeError) {
        console.warn("[GET /api/models] Cache size limit exceeded, using direct DB query", {
          searchParams: { cursor: search.cursor, size: search.size, sort: search.sort },
          error: errorMessage,
        });
      } else {
        console.warn("[GET /api/models] Cache lookup failed, falling back to DB", {
          searchParams: { cursor: search.cursor, size: search.size, sort: search.sort },
          error: errorMessage,
        });
      }
      
      // Fallback to direct DB query
      const result = await modelsCache.getModelsFiltered(search);
      filteredModels = result.data;
      totalCount = result.totalCount;
      filterCount = result.filterCount;
    }

    // Convert to ModelsRowWithId format
    const paginatedData: ModelsRowWithId[] = filteredModels.map((model) => ({
      uuid: model.id,
      ...model,
    }));

    // Generate facets from database using SQL aggregations (no full data load)
    // This avoids the 2MB cache limit while still providing facet data
    const facetsData = await getCachedFacets();
    const facets = {
      provider: facetsData.provider,
      author: facetsData.author,
      modalities: facetsData.modalities,
      name: facetsData.name,
    };

    // Convert back to ModelsColumnSchema format
    const data: ModelsColumnSchema[] = paginatedData.map((row) => ({
      id: row.uuid,
      slug: row.slug,
      provider: row.provider,
      name: row.name || null,
      shortName: row.shortName || null,
      author: row.author || null,
      description: row.description || null,
      modelVersionGroupId: row.modelVersionGroupId || null,
      contextLength: row.contextLength || null,
      inputModalities: row.inputModalities,
      outputModalities: row.outputModalities,
      hasTextOutput: row.hasTextOutput,
      group: row.group || null,
      instructType: row.instructType || null,
      permaslug: row.permaslug || null,
      endpointId: row.endpointId || null,
      pricing: row.pricing,
      features: row.features,
      mmlu: row.mmlu ?? null,
      maxCompletionTokens: row.maxCompletionTokens ?? null,
      supportedParameters: Array.isArray(row.supportedParameters)
        ? row.supportedParameters
        : [],
      scrapedAt: row.scrapedAt,
    }));

    const cursor = typeof search.cursor === 'number' && search.cursor >= 0 ? search.cursor : 0;
    const size = Math.min(Math.max(1, search.size ?? 50), 200); // Clamp size between 1 and 200

    const response: ModelsInfiniteQueryResponse<ModelsColumnSchema[], ModelsLogsMeta> = {
      data,
      meta: {
        totalRowCount: totalCount, // Total matching filters
        filterRowCount: filterCount, // Same as totalCount
        facets,
      },
      prevCursor: cursor > 0 ? cursor - size : null,
      nextCursor: cursor + size < totalCount ? cursor + size : null,
    };

    const res = Response.json(response);
    logger.info(
      JSON.stringify({
        event: "api.models.page",
        cursor,
        size,
        rowsReturned: data.length,
        nextCursor: response.nextCursor,
        filterCount,
        latencyMs: Date.now() - t1,
      }),
    );
    return res;
  } catch (error) {
    console.error("Models API error:", error);
    return Response.json(
      { error: "Failed to fetch models data" },
      { status: 500 }
    );
  }
}
