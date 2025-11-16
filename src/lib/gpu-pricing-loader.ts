import type { InfiniteQueryResponse, LogsMeta } from "@/components/infinite-table/query-options";
import type { ColumnSchema, FacetMetadataSchema } from "@/components/infinite-table/schema";
import type { SearchParamsType } from "@/components/infinite-table/search-params";
import { gpuPricingCache } from "@/lib/gpu-pricing-cache";
import { unstable_cache } from "next/cache";
import { createHash } from "crypto";

const CACHE_SIZE_LIMIT_BYTES = 2 * 1024 * 1024; // 2MB

// Cache facets generation (uses SQL aggregations, not full data load)
// Cache for 12 hours - data only changes when scraper runs, which invalidates cache
const getCachedFacets = unstable_cache(
  async () => {
    return await gpuPricingCache.getGpusFacets();
  },
  ["pricing:facets"],
  {
    revalidate: 43200,
    tags: ["pricing"],
  },
);

const cryptoHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

function hashSearchParams(search: SearchParamsType): string {
  const sortedEntries = Object.entries(search ?? {})
    .map(([key, value]) => [key, value] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  return cryptoHash(JSON.stringify(sortedEntries));
}

async function getCachedGpusFiltered(search: SearchParamsType) {
  const cacheFn = unstable_cache(
    async () => {
      const result = await gpuPricingCache.getGpusFiltered(search);

      const estimatedSize = JSON.stringify(result).length;

      if (estimatedSize > CACHE_SIZE_LIMIT_BYTES) {
        console.warn(
          "[getCachedGpusFiltered] Cache size limit exceeded, will fall back to direct DB query",
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
    ["pricing:filtered", hashSearchParams(search)],
    {
      revalidate: 43200,
      tags: ["pricing"],
    },
  );

  return cacheFn();
}

export async function getGpuPricingPage(
  search: SearchParamsType,
): Promise<InfiniteQueryResponse<ColumnSchema[], LogsMeta>> {
  let filteredGpus: ColumnSchema[];
  let totalCount: number;
  let filterCount: number;

  try {
    const result = await getCachedGpusFiltered(search);
    filteredGpus = result.data as ColumnSchema[];
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
        "[getGpuPricingPage] Cache size limit exceeded, using direct DB query",
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
      console.warn(
        "[getGpuPricingPage] Cache lookup failed, falling back to DB",
        {
          searchParams: {
            cursor: search.cursor,
            size: search.size,
            sort: search.sort,
          },
          error: errorMessage,
        },
      );
    }

    const result = await gpuPricingCache.getGpusFiltered(search);
    filteredGpus = result.data as ColumnSchema[];
    totalCount = result.totalCount;
    filterCount = result.filterCount;
  }

  const facetsData = await getCachedFacets();
  const facets: Record<string, FacetMetadataSchema> = {
    provider: facetsData.provider,
    type: facetsData.type,
    gpu_model: facetsData.gpu_model,
    vram_gb: facetsData.vram_gb,
    price_hour_usd: facetsData.price_hour_usd,
  };

  const pageSize = search.size ?? 50;
  const startOffset =
    typeof search.cursor === "number" && search.cursor >= 0
      ? search.cursor
      : 0;
  const nextCursor =
    startOffset + filteredGpus.length < filterCount
      ? startOffset + filteredGpus.length
      : null;
  const prevCursor =
    startOffset > 0 ? Math.max(0, startOffset - pageSize) : null;

  return {
    data: filteredGpus,
    meta: {
      totalRowCount: totalCount,
      filterRowCount: filterCount,
      facets,
      metadata: {} satisfies LogsMeta,
    },
    prevCursor,
    nextCursor,
  };
}
