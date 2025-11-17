import type { InfiniteQueryResponse, LogsMeta } from "@/components/infinite-table/query-options";
import type { ColumnSchema } from "@/components/infinite-table/schema";
import { searchParamsCache } from "@/components/infinite-table/search-params";
import type { SearchParamsType } from "@/components/infinite-table/search-params";
import { logger } from "@/lib/logger";
import { getRequestLogContext } from "@/lib/request-log-context";
import { getGpuPricingPage } from "@/lib/gpu-pricing-loader";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  try {
    const logContext = getRequestLogContext(req);
    // Note: using GET for simplicity; consider POST if query size grows
    const requestUrl = new URL(req.url);
    const _search: Map<string, string> = new Map();
    requestUrl.searchParams.forEach((value, key) => _search.set(key, value));

    const search: SearchParamsType = searchParamsCache.parse(Object.fromEntries(_search));

    const t1 = Date.now();
    const result = await getGpuPricingPage(search);
    const res = Response.json(result satisfies InfiniteQueryResponse<ColumnSchema[], LogsMeta>);
    logger.info({
      event: "api.page",
      cursor: search.cursor ?? 0,
      size: search.size ?? 50,
      rowsReturned: result.data.length,
      nextCursor: result.nextCursor,
      filterCount: result.meta.filterRowCount,
      latencyMs: Date.now() - t1,
      ...logContext,
    });
    return res;
  } catch (error) {
    console.error("Error in pricing API:", error);
    return Response.json(
      {
        error: "Failed to fetch pricing data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
