import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { modelsCache } from "@/lib/models-cache";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { ModelsColumnSchema } from "@/components/models-table/models-schema";
import type { ModelsInfiniteQueryResponse, ModelsLogsMeta } from "@/components/models-table/models-query-options";
import { modelsSearchParamsCache } from "@/components/models-table/models-search-params";
import type { ModelsSearchParamsType } from "@/components/models-table/models-search-params";
import { toModelsColumnRow } from "@/lib/models/transformers";
import { unstable_cache } from "next/cache";
import type { AIModel } from "@/types/models";

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

// Cache favorite models query (with userId and search params in cache key)
// This reduces DB load for frequently accessed favorites
// Includes explicit 2MB size check to handle large JSONB fields gracefully
const getCachedFavoriteModelsFiltered = unstable_cache(
  async (userId: string, search: ModelsSearchParamsType) => {
    const result = await modelsCache.getFavoriteModelsFiltered(userId, search);
    
    // Check size before caching (conservative estimate using JSON.stringify)
    // If > 2MB, Next.js unstable_cache will fail to cache, so we throw here
    // to trigger fallback to direct DB query in the caller
    const estimatedSize = JSON.stringify(result).length;
    
    if (estimatedSize > CACHE_SIZE_LIMIT_BYTES) {
      console.warn("[getCachedFavoriteModelsFiltered] Cache size limit exceeded, will fall back to direct DB query", {
        userId,
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
  (userId: string, search: ModelsSearchParamsType) => [
    "model-favorites:filtered",
    userId,
    JSON.stringify(search ?? {}),
  ],
  {
    revalidate: 43200, // 12 hours (data only changes when scraper runs, cache invalidated on scrape)
    tags: ["model-favorites"],
  }
);

// Get favorite rows with database-level sorting and pagination (TanStack Table best practice)
async function getFavoriteRowsDirect(
  userId: string,
  search: ModelsSearchParamsType
): Promise<ModelsInfiniteQueryResponse<ModelsColumnSchema[], ModelsLogsMeta>> {
  // Use cached query to reduce DB load
  // If cache fails (e.g., > 2MB), falls back to DB query gracefully
  let filteredModels: Awaited<ReturnType<typeof modelsCache.getFavoriteModelsFiltered>>['data'];
  let totalCount: number;
  let filterCount: number;
  
  try {
    const result = await getCachedFavoriteModelsFiltered(userId, search);
    filteredModels = result.data;
    totalCount = result.totalCount;
    filterCount = result.filterCount;
  } catch (error) {
    // Fallback to direct DB query if cache fails (e.g., > 2MB or cache error)
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isSizeError = errorMessage.includes("2MB") || errorMessage.includes("size") || errorMessage.includes("cache");
    
    if (isSizeError) {
      console.warn("[getFavoriteRowsDirect] Cache size limit exceeded, using direct DB query", {
        userId,
        searchParams: { cursor: search.cursor, size: search.size, sort: search.sort },
        error: errorMessage,
      });
    }
    
    // Fallback to direct DB query
    const result = await modelsCache.getFavoriteModelsFiltered(userId, search);
    filteredModels = result.data;
    totalCount = result.totalCount;
    filterCount = result.filterCount;
  }

  const facets = await getCachedFacets();

  if (filteredModels.length === 0) {
    return {
      data: [],
      meta: {
        totalRowCount: totalCount,
        filterRowCount: filterCount,
        facets,
      },
      prevCursor: null,
      nextCursor: null,
    };
  }

  // Convert to ModelsColumnSchema format
  const data: ModelsColumnSchema[] = filteredModels.map((model) => toModelsColumnRow(model));

  const start = typeof search.cursor === "number" && search.cursor >= 0 ? search.cursor : 0;
  const pageSize = Math.min(Math.max(1, search.size ?? 50), 200);
  return {
    data,
    meta: {
      totalRowCount: totalCount,
      filterRowCount: filterCount,
      facets,
    },
    prevCursor: start > 0 ? Math.max(0, start - pageSize) : null,
    nextCursor: start + data.length < filterCount ? start + data.length : null,
  };
}

const RequestSchema = z.object({
  keys: z.array(z.string().min(1)).max(200),
});

/**
 * GET /api/models/favorites/rows
 * Fetches favorite rows with database-level sorting and pagination
 * Uses JOIN to combine userModelFavorites with aiModels
 * Follows TanStack Table's recommended pattern for server-side pagination
 * 
 * Query params:
 * - cursor: number (offset for pagination)
 * - size: number (page size, default 50)
 * - sort: string (format: "id.desc" or "id.asc")
 * 
 * @returns 200 with paginated favorite model rows
 * @returns 401 if not authenticated
 * @returns 500 on server error
 */
export async function GET(req: NextRequest) {
  try {
    const hdrs = await headers();
    const session = await auth.api.getSession({ headers: hdrs });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query parameters
    const _search: Map<string, string> = new Map();
    req.nextUrl.searchParams.forEach((value, key) => _search.set(key, value));
    const search = modelsSearchParamsCache.parse(Object.fromEntries(_search));
    
    const cursor = search.cursor ?? null;
    // Validate and clamp size parameter to prevent memory abuse
    // Min: 1, Max: 200, Default: 50
    const size = Math.min(Math.max(1, search.size ?? 50), 200);
    const normalizedSearch: ModelsSearchParamsType = {
      ...search,
      cursor,
      size,
    };

    // Get paginated rows with database-level sorting and pagination
    // This only loads the rows needed for the current page, not all favorites
    // Cached server-side with 12 hour TTL to reduce DB load
    const result = await getFavoriteRowsDirect(session.user.id, normalizedSearch);
    return NextResponse.json(result, {
      headers: {
        // Use private cache since this is user-specific data
        // This prevents Vercel edge/CDN from caching responses
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[GET /api/models/favorites/rows] Failed to fetch favorite rows", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/models/favorites/rows
 * Fetches rows for specific favorite keys (used for optimistic updates)
 */
export async function POST(request: NextRequest) {
  try {
    const parsed = RequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const rows = await modelsCache.getModelsByIds(parsed.data.keys);
    return NextResponse.json({ rows: rows.map(toModelsColumnRow) });
  } catch (error) {
    console.error("[POST /api/models/favorites/rows] Failed to resolve rows", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
