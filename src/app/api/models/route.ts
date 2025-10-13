import { NextRequest } from "next/server";
import type { ModelsInfiniteQueryResponse, ModelsLogsMeta } from "@/components/models-table/models-query-options";
import type { ModelsColumnSchema } from "@/components/models-table/models-schema";
import { modelsSearchParamsCache } from "@/components/models-table/models-search-params";
import type { ModelsSearchParamsType } from "@/components/models-table/models-search-params";
import { modelsCache } from "@/lib/models-cache";
import type { AIModel } from "@/types/models";

// AI Model row interface for filtering/sorting system
interface ModelsRowWithId extends AIModel {
  uuid: string;
}

// Simple filtering function for AI models
function filterModelsData(data: ModelsRowWithId[], search: ModelsSearchParamsType): ModelsRowWithId[] {
  return data.filter((row) => {
    // Provider filter
    if (search.provider && row.provider !== search.provider) {
      return false;
    }

    // Group filter
    if (search.group && row.group !== search.group) {
      return false;
    }

    // Name filter (partial match)
    if (search.name && !row.name?.toLowerCase().includes(search.name.toLowerCase())) {
      return false;
    }

    // Description filter (partial match)
    if (search.description && !row.description?.toLowerCase().includes(search.description.toLowerCase())) {
      return false;
    }

    // Input modalities filter (array contains)
    if (search.inputModalities && search.inputModalities.length > 0) {
      const hasAllModalities = search.inputModalities.every(modality =>
        row.inputModalities.includes(modality)
      );
      if (!hasAllModalities) {
        return false;
      }
    }

    // Search filter (global search across name, description, provider)
    if (search.search) {
      const searchTerm = search.search.toLowerCase();
      const searchableText = [
        row.name,
        row.description,
        row.provider,
        row.group
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
      case 'outputModalities':
        // Sort by joined modalities string (e.g., "Text/Image")
        aValue = (a.outputModalities || []).sort().join('/');
        bValue = (b.outputModalities || []).sort().join('/');
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
    rows: Object.entries(providerCounts).map(([value, total]) => ({ value, total })),
    total: data.length
  };

  // Group facet
  const groupCounts: Record<string, number> = {};
  data.forEach(row => {
    if (row.group) {
      groupCounts[row.group] = (groupCounts[row.group] || 0) + 1;
    }
  });
  facets.group = {
    rows: Object.entries(groupCounts).map(([value, total]) => ({ value, total })),
    total: data.length
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

    // Generate facets for filter UI
    const facets = generateModelsFacets(filteredData);

    // Convert back to ModelsColumnSchema format
    const data: ModelsColumnSchema[] = paginatedData.map((row) => ({
      id: row.uuid,
      slug: row.slug,
      provider: row.provider,
      name: row.name || null,
      shortName: row.shortName || null,
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