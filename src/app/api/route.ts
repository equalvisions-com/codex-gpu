import { NextRequest } from "next/server";
import type { InfiniteQueryResponse, LogsMeta } from "@/components/infinite-table/query-options";
import type { ColumnSchema, FacetMetadataSchema } from "@/components/infinite-table/schema";
import type { RowWithId, RowId } from "@/types/api";
import { searchParamsCache } from "@/components/infinite-table/search-params";
import type { SearchParamsType } from "@/components/infinite-table/search-params";
import { logger } from "@/lib/logger";
import { gpuPricingStore } from "@/lib/gpu-pricing-store";
import {
  filterData,
  getFacetsFromData,
  percentileData,
  sliderFilterValues,
  sortData,
} from "@/components/infinite-table/api/helpers";
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

export async function GET(req: NextRequest): Promise<Response> {
  try {
    // Note: using GET for simplicity; consider POST if query size grows
    const _search: Map<string, string> = new Map();
    req.nextUrl.searchParams.forEach((value, key) => _search.set(key, value));

    const search: SearchParamsType = searchParamsCache.parse(Object.fromEntries(_search));

    const pricingRows = await gpuPricingStore.getAllRows();
    let totalData: RowWithId[] = pricingRows;

    // Apply date filtering if specified
    const observedFilter = Array.isArray(search.observed_at)
      ? (search.observed_at as unknown as Date[])
      : undefined;
    const dateRange =
      observedFilter?.length === 1
        ? [observedFilter[0], new Date(observedFilter[0].getTime() + 24 * 60 * 60 * 1000)]
        : observedFilter;

    // Exclude slider filters when building facets to preserve min/max metadata
    const restFilters: Partial<SearchParamsType> = { ...search };
    for (const key of sliderFilterValues) {
      delete (restFilters as Record<string, unknown>)[key];
    }

    const rangedData = filterData(totalData, { observed_at: dateRange });
    const withoutSliderData = filterData(rangedData, { ...restFilters, observed_at: null });
    const filteredData = filterData(withoutSliderData, { ...search, observed_at: null });
    const sortParam = search.sort ?? { id: "provider", desc: false };
    const sortedData = sortData(filteredData, sortParam);
    const facets = getFacetsFromData(totalData);
    sortProviderFacet(facets);
    sortModelFacet(facets);
    const withPercentileData = percentileData(sortedData);

    // Cursor windowing by numeric offset (simple, server-driven)
    const pageSize = search.size ?? 50;
    const startOffset = typeof search.cursor === 'number' && search.cursor >= 0 ? search.cursor : 0;
    const data = withPercentileData.slice(startOffset, startOffset + pageSize);
    const nextCursor = startOffset + data.length < withPercentileData.length ? startOffset + data.length : null;
    const prevCursor = startOffset > 0 ? Math.max(0, startOffset - pageSize) : null;

    const t1 = Date.now();
    const rowsOut = data;
    const res = Response.json({
      data: rowsOut,
      meta: {
        totalRowCount: totalData.length,
        filterRowCount: filteredData.length,
        facets: {
          ...facets,
        },
        metadata: {} satisfies LogsMeta,
      },
      prevCursor,
      nextCursor,
    } satisfies InfiniteQueryResponse<ColumnSchema[], LogsMeta>, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=86400',
      },
    });
    logger.info(JSON.stringify({ event: 'api.page', rowsReturned: rowsOut.length, latencyMs: Date.now() - t1 }));
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
