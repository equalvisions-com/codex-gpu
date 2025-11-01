import { NextRequest } from "next/server";
import type { InfiniteQueryResponse, LogsMeta } from "@/components/infinite-table/query-options";
import type { ColumnSchema, FacetMetadataSchema } from "@/components/infinite-table/schema";
import { searchParamsCache } from "@/components/infinite-table/search-params";
import type { SearchParamsType } from "@/components/infinite-table/search-params";
import { logger } from "@/lib/logger";
import { gpuPricingCache } from "@/lib/gpu-pricing-cache";
import { unstable_cache } from "next/cache";

export const dynamic = 'force-dynamic';

const PROVIDER_SORT_PRIORITY: Record<string, number> = {
  coreweave: 1,
  lambda: 2,
  runpod: 3,
  digitalocean: 4,
  oracle: 5,
  nebius: 6,
  hyperstack: 7,
  crusoe: 8,
};

function sortProviderFacet(facets?: Record<string, FacetMetadataSchema>) {
  if (!facets?.provider?.rows?.length) return;

  facets.provider.rows.sort((a, b) => {
    const aKey = String(a.value).toLowerCase();
    const bKey = String(b.value).toLowerCase();
    const aPriority = PROVIDER_SORT_PRIORITY[aKey] ?? Number.MAX_SAFE_INTEGER;
    const bPriority = PROVIDER_SORT_PRIORITY[bKey] ?? Number.MAX_SAFE_INTEGER;

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    return aKey.localeCompare(bKey);
  });
}

function sortModelFacet(facets?: Record<string, FacetMetadataSchema>) {
  if (!facets?.gpu_model?.rows?.length) return;

  facets.gpu_model.rows.sort((a, b) =>
    String(a.value).localeCompare(String(b.value), undefined, {
      sensitivity: "base",
    }),
  );
}

const CACHE_SIZE_LIMIT_BYTES = 2 * 1024 * 1024; // 2MB

// Cache facets generation (uses SQL aggregations, not full data load)
// This avoids the 2MB cache limit while still providing facet data
// Cache for 12 hours - data only changes when scraper runs, which invalidates cache
const getCachedFacets = unstable_cache(
  async () => {
    return await gpuPricingCache.getGpusFacets();
  },
  ["pricing:facets"],
  {
    revalidate: 43200, // 12 hours (data only changes when scraper runs, cache invalidated on scrape)
    tags: ["pricing"],
  }
);

// Cache paginated query results (with search params in cache key)
// This reduces DB load while maintaining data freshness
// Includes explicit 2MB size check to handle large JSONB fields gracefully
const getCachedGpusFiltered = unstable_cache(
  async (search: SearchParamsType) => {
    const result = await gpuPricingCache.getGpusFiltered(search);
    
    // Check size before caching (conservative estimate using JSON.stringify)
    // If > 2MB, Next.js unstable_cache will fail to cache, so we throw here
    // to trigger fallback to direct DB query in the caller
    const estimatedSize = JSON.stringify(result).length;
    
    if (estimatedSize > CACHE_SIZE_LIMIT_BYTES) {
      console.warn("[getCachedGpusFiltered] Cache size limit exceeded, will fall back to direct DB query", {
        estimatedSizeBytes: estimatedSize,
        limitBytes: CACHE_SIZE_LIMIT_BYTES,
        rowCount: result.data.length,
        searchParams: { cursor: search.cursor, size: search.size, sort: search.sort },
      });
      
      // Throw error to prevent caching and trigger fallback
      // Next.js unstable_cache will fail anyway, but this ensures we handle it gracefully
      throw new Error(`Cache size (${estimatedSize} bytes) exceeds limit (${CACHE_SIZE_LIMIT_BYTES} bytes)`);
    }
    
    return result;
  },
  ["pricing:filtered"],
  {
    revalidate: 43200, // 12 hours (data only changes when scraper runs, cache invalidated on scrape)
    tags: ["pricing"],
  }
);

export async function GET(req: NextRequest): Promise<Response> {
  try {
    // Note: using GET for simplicity; consider POST if query size grows
    const _search: Map<string, string> = new Map();
    req.nextUrl.searchParams.forEach((value, key) => _search.set(key, value));

    const search: SearchParamsType = searchParamsCache.parse(Object.fromEntries(_search));

    // Fetch filtered, sorted, paginated data from database (TanStack Table best practice)
    // Cached server-side with 2min TTL to reduce DB load
    // This only loads the rows needed for the current page, not all rows
    // If cache fails (e.g., > 2MB), falls back to DB query gracefully
    let filteredGpus: ColumnSchema[];
    let totalCount: number;
    let filterCount: number;
    
    try {
      const result = await getCachedGpusFiltered(search);
      filteredGpus = result.data;
      totalCount = result.totalCount;
      filterCount = result.filterCount;
    } catch (error) {
      // Fallback to direct DB query if cache fails (e.g., > 2MB or cache error)
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isSizeError = errorMessage.includes("2MB") || errorMessage.includes("size") || errorMessage.includes("cache");
      
      if (isSizeError) {
        console.warn("[GET /api] Cache size limit exceeded, using direct DB query", {
          searchParams: { cursor: search.cursor, size: search.size, sort: search.sort },
          error: errorMessage,
        });
      }
      
      // Fallback to direct DB query
      const result = await gpuPricingCache.getGpusFiltered(search);
      filteredGpus = result.data;
      totalCount = result.totalCount;
      filterCount = result.filterCount;
    }

    // Generate facets from database using SQL aggregations (no full data load)
    // This avoids the 2MB cache limit while still providing facet data
    const facetsData = await getCachedFacets();
    
    // Apply facet sorting (provider and model)
    const facets = {
      provider: facetsData.provider,
      type: facetsData.type,
      gpu_model: facetsData.gpu_model,
      vram_gb: facetsData.vram_gb,
      price_hour_usd: facetsData.price_hour_usd,
    };
    
    sortProviderFacet(facets);
    sortModelFacet(facets);

    // Pagination cursor calculation
    const pageSize = search.size ?? 50;
    const startOffset = typeof search.cursor === 'number' && search.cursor >= 0 ? search.cursor : 0;
    const nextCursor = startOffset + filteredGpus.length < filterCount ? startOffset + filteredGpus.length : null;
    const prevCursor = startOffset > 0 ? Math.max(0, startOffset - pageSize) : null;

    const t1 = Date.now();
    const res = Response.json({
      data: filteredGpus,
      meta: {
        totalRowCount: totalCount,
        filterRowCount: filterCount,
        facets,
        metadata: {} satisfies LogsMeta,
      },
      prevCursor,
      nextCursor,
    } satisfies InfiniteQueryResponse<ColumnSchema[], LogsMeta>, {
      headers: {
        'Cache-Control': 'public, s-maxage=43200, stale-while-revalidate=3600',
      },
    });
    logger.info(JSON.stringify({ event: 'api.page', rowsReturned: filteredGpus.length, latencyMs: Date.now() - t1 }));
    return res;
  } catch (error) {
    console.error('Error in pricing API:', error);
    return Response.json(
      {
        error: 'Failed to fetch pricing data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
