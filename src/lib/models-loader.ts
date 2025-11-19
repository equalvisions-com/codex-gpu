import type {
  ModelsInfiniteQueryResponse,
  ModelsLogsMeta,
} from "@/components/models-table/models-query-options";
import type { ModelsColumnSchema } from "@/components/models-table/models-schema";
import type { ModelsSearchParamsType } from "@/components/models-table/models-search-params";
import { modelsCache } from "@/lib/models-cache";
import type { AIModel } from "@/types/models";
import { unstable_cache } from "next/cache";
import { createHash } from "crypto";

const CACHE_SIZE_LIMIT_BYTES = 2 * 1024 * 1024; // 2MB

const getCachedFacets = unstable_cache(
  async () => {
    return await modelsCache.getModelsFacets();
  },
  ["models:facets"],
  {
    revalidate: 43200,
    tags: ["models"],
  },
);

const cryptoHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

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
        console.warn(
          "[getCachedModelsFiltered] Cache size limit exceeded, will fall back to direct DB query",
          {
            estimatedSizeBytes: estimatedSize,
            limitBytes: CACHE_SIZE_LIMIT_BYTES,
            rowCount: result.data.length,
            searchParams: {
              cursor: search.cursor,
              size: search.size,
              sort: search.sort,
            },
          },
        );

        throw new Error(
          `Cache size (${estimatedSize} bytes) exceeds limit (${CACHE_SIZE_LIMIT_BYTES} bytes)`,
        );
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

function mapToColumnSchema(model: AIModel): ModelsColumnSchema {
  return {
    id: model.id,
    slug: model.slug,
    provider: model.provider,
    name: model.name || null,
    shortName: model.shortName || null,
    author: model.author || null,
    description: model.description || null,
    modelVersionGroupId: model.modelVersionGroupId || null,
    contextLength: model.contextLength ?? null,
    inputModalities: model.inputModalities,
    outputModalities: model.outputModalities,
    permaslug: model.permaslug || null,
    endpointId: model.endpointId || null,
    promptPrice: model.promptPrice ?? null,
    completionPrice: model.completionPrice ?? null,
    modalityScore: model.modalityScore ?? null,
    mmlu: model.mmlu ?? null,
    maxCompletionTokens: model.maxCompletionTokens ?? null,
    supportedParameters: Array.isArray(model.supportedParameters)
      ? model.supportedParameters
      : [],
    scrapedAt: model.scrapedAt,
  };
}

export async function getModelsPage(
  search: ModelsSearchParamsType,
): Promise<ModelsInfiniteQueryResponse<ModelsColumnSchema[], ModelsLogsMeta>> {
  let filteredModels: AIModel[];
  let totalCount: number;
  let filterCount: number;

  try {
    const result = await getCachedModelsFiltered(search);
    filteredModels = result.data;
    totalCount = result.totalCount;
    filterCount = result.filterCount;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    const isSizeError =
      errorMessage.includes("2MB") ||
      errorMessage.includes("size") ||
      errorMessage.includes("cache");

    if (isSizeError) {
      console.warn(
        "[getModelsPage] Cache size limit exceeded, using direct DB query",
        {
          searchParams: {
            cursor: search.cursor,
            size: search.size,
            sort: search.sort,
          },
          error: errorMessage,
        },
      );
    } else {
      console.warn("[getModelsPage] Cache lookup failed, falling back to DB", {
        searchParams: {
          cursor: search.cursor,
          size: search.size,
          sort: search.sort,
        },
        error: errorMessage,
      });
    }

    const result = await modelsCache.getModelsFiltered(search);
    filteredModels = result.data;
    totalCount = result.totalCount;
    filterCount = result.filterCount;
  }

  const facetsData = await getCachedFacets();
  const facets = {
    provider: facetsData.provider,
    author: facetsData.author,
    modalities: facetsData.modalities,
    name: facetsData.name,
  };

  const cursor =
    typeof search.cursor === "number" && search.cursor >= 0
      ? search.cursor
      : 0;
  const size = Math.min(Math.max(1, search.size ?? 50), 200);

  return {
    data: filteredModels.map(mapToColumnSchema),
    meta: {
      totalRowCount: totalCount,
      filterRowCount: filterCount,
      facets,
    },
    prevCursor: cursor > 0 ? cursor - size : null,
    nextCursor: cursor + size < totalCount ? cursor + size : null,
  };
}
