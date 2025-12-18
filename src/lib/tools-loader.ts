import type {
  ToolInfiniteQueryResponse,
  ToolLogsMeta,
} from "@/features/data-explorer/tools/tools-query-options";
import type { ToolColumnSchema, ToolsFacetMetadataSchema } from "@/features/data-explorer/tools/tools-schema";
import type { ToolsSearchParamsType } from "@/features/data-explorer/tools/tools-search-params";
import { toolsCache } from "@/lib/tools-cache";
import { unstable_cache } from "next/cache";
import { createHash } from "crypto";
import { STANDARD_CACHE_TTL } from "@/lib/cache/constants";
import type { Tool } from "@/types/tools";
import { stableToolKey } from "@/features/data-explorer/stable-keys";

const CACHE_SIZE_LIMIT_BYTES = 2 * 1024 * 1024; // 2MB

const getCachedFacets = unstable_cache(
  async () => {
    return await toolsCache.getToolFacets();
  },
  ["tools:facets"],
  {
    revalidate: STANDARD_CACHE_TTL,
    tags: ["tools"],
  },
);

const cryptoHash = (value: string) => createHash("sha256").update(value).digest("hex");

function hashToolSearchParams(search: ToolsSearchParamsType): string {
  const sortedEntries = Object.entries(search ?? {})
    .map(([key, value]) => [key, value] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  return cryptoHash(JSON.stringify(sortedEntries));
}

async function getCachedToolsFiltered(search: ToolsSearchParamsType) {
  const cacheFn = unstable_cache(
    async () => {
      const result = await toolsCache.getToolsFiltered(search);
      const estimatedSize = JSON.stringify(result).length;
      if (estimatedSize > CACHE_SIZE_LIMIT_BYTES) {
        console.warn("[getCachedToolsFiltered] Cache size limit exceeded, will fall back to direct DB query", {
          estimatedSizeBytes: estimatedSize,
          limitBytes: CACHE_SIZE_LIMIT_BYTES,
          rowCount: result.data.length,
          searchParams: { cursor: search.cursor, size: search.size, sort: search.sort },
        });
        throw new Error(`Cache size (${estimatedSize} bytes) exceeds limit (${CACHE_SIZE_LIMIT_BYTES} bytes)`);
      }
      return result;
    },
    ["tools:filtered", hashToolSearchParams(search)],
    {
      revalidate: STANDARD_CACHE_TTL,
      tags: ["tools"],
    },
  );
  return cacheFn();
}

function mapToColumnSchema(tool: Tool): ToolColumnSchema {
  return {
    id: tool.id,
    name: tool.name,
    developer: tool.developer,
    description: tool.description,
    category: tool.category,
    price: tool.price,
    license: tool.license,
    url: tool.url,
    stack: tool.stack,
    oss: tool.oss,
    stable_key: tool.stableKey || stableToolKeyFromTool(tool),
  };
}

function stableToolKeyFromTool(tool: Tool) {
  return stableToolKey({
    id: tool.id,
    name: tool.name ?? undefined,
    developer: tool.developer ?? undefined,
    category: tool.category ?? undefined,
    license: tool.license ?? undefined,
  });
}

export async function getToolsPage(
  search: ToolsSearchParamsType,
): Promise<ToolInfiniteQueryResponse<ToolColumnSchema[], ToolLogsMeta>> {
  let filteredTools: Tool[];
  let totalCount: number;
  let filterCount: number;

  try {
    const result = await getCachedToolsFiltered(search);
    filteredTools = result.data;
    totalCount = result.totalCount;
    filterCount = result.filterCount;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isSizeError = errorMessage.includes("2MB") || errorMessage.includes("size") || errorMessage.includes("cache");
    if (isSizeError) {
      console.warn("[getToolsPage] Cache size limit exceeded, using direct DB query", {
        searchParams: { cursor: search.cursor, size: search.size, sort: search.sort },
        error: errorMessage,
      });
    } else {
      console.warn("[getToolsPage] Cache lookup failed, falling back to DB", {
        searchParams: { cursor: search.cursor, size: search.size, sort: search.sort },
        error: errorMessage,
      });
    }

    const result = await toolsCache.getToolsFiltered(search);
    filteredTools = result.data;
    totalCount = result.totalCount;
    filterCount = result.filterCount;
  }

  const facetsData = await getCachedFacets();
  const facets: Record<string, ToolsFacetMetadataSchema> = {
    developer: facetsData.developer,
    license: facetsData.license,
    category: facetsData.category,
    price: facetsData.price,
    stack: facetsData.stack,
    oss: facetsData.oss,
  };

  const cursor = typeof search.cursor === "number" && search.cursor >= 0 ? search.cursor : 0;
  const size = Math.min(Math.max(1, search.size ?? 50), 200);

  const nextCursor = cursor + filteredTools.length < filterCount ? cursor + filteredTools.length : null;
  const prevCursor = cursor > 0 ? Math.max(0, cursor - size) : null;

  return {
    data: filteredTools.map(mapToColumnSchema),
    meta: {
      totalRowCount: totalCount,
      filterRowCount: filterCount,
      facets,
      metadata: {},
    },
    prevCursor,
    nextCursor,
  };
}
