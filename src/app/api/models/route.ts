import { NextRequest } from "next/server";
import type { ModelsInfiniteQueryResponse, ModelsLogsMeta } from "@/components/models-table/models-query-options";
import type { ModelsColumnSchema } from "@/components/models-table/models-schema";
import { modelsSearchParamsCache } from "@/components/models-table/models-search-params";
import type { ModelsSearchParamsType } from "@/components/models-table/models-search-params";
import { modelsCache } from "@/lib/models-cache";
import type { AIModel } from "@/types/models";

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

    // Search filter (global search across name, description, provider, author)
    if (search.search) {
      const searchTerm = search.search.toLowerCase();
      const searchableText = [
        row.name,
        row.description,
        row.provider,
        row.author
      ].filter(Boolean).join(' ').toLowerCase();

      if (!searchableText.includes(searchTerm)) {
        return false;
      }
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
      case 'name':
        aValue = a.name || '';
        bValue = b.name || '';
        break;
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

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  try {
    // Note: using GET for simplicity; consider POST if query size grows
    const _search: Map<string, string> = new Map();
    req.nextUrl.searchParams.forEach((value, key) => _search.set(key, value));

    const search: ModelsSearchParamsType = modelsSearchParamsCache.parse(Object.fromEntries(_search));

    // Get all models from database
    const allModels = await modelsCache.getAllModels();

    // Convert to ModelsRowWithId format
    const totalData: ModelsRowWithId[] = allModels.map((model) => ({
      uuid: model.id,
      ...model,
    }));

    // Apply filters
    const filteredData = filterModelsData(totalData, search);

    // Apply sorting
    const sortedData = sortModelsData(filteredData, search.sort || undefined);

    // Apply pagination using cursor (for infinite scrolling)
    const start = typeof search.cursor === 'number' && search.cursor >= 0 ? search.cursor : 0;
    const size = search.size ?? 50;
    const paginatedData = sortedData.slice(start, start + size);

    // Generate facets for filter UI (from all data, not filtered data)
    const facets = generateModelsFacets(totalData);

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
      pricing: row.pricing,
      features: row.features,
      endpoint: row.endpoint,
      mmlu: row.mmlu ?? null,
      scrapedAt: row.scrapedAt,
    }));

    const response: ModelsInfiniteQueryResponse<ModelsColumnSchema[], ModelsLogsMeta> = {
      data,
      meta: {
        totalRowCount: filteredData.length,
        filterRowCount: filteredData.length,
        facets,
      },
      prevCursor: start > 0 ? start - size : null,
      nextCursor: start + size < filteredData.length ? start + size : null,
    };

    return Response.json(response);
  } catch (error) {
    console.error("Models API error:", error);
    return Response.json(
      { error: "Failed to fetch models data" },
      { status: 500 }
    );
  }
}
