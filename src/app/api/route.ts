import type { InfiniteQueryResponse, LogsMeta } from "@/features/data-explorer/table/query-options";
import type { ColumnSchema } from "@/features/data-explorer/table/schema";
import { searchParamsCache } from "@/features/data-explorer/table/search-params";
import type { SearchParamsType } from "@/features/data-explorer/table/search-params";
import { logger } from "@/lib/logger";
import { getRequestLogContext } from "@/lib/request-log-context";
import { getGpuPricingPage } from "@/lib/gpu-pricing-loader";
import { readLimiter, getReadRateLimitKey } from "@/lib/redis/ratelimit";

function buildRateHeaders(limit?: number, remaining?: number, reset?: number) {
  const headers: Record<string, string> = {};
  if (typeof limit === "number") headers["X-RateLimit-Limit"] = String(limit);
  if (typeof remaining === "number") headers["X-RateLimit-Remaining"] = String(remaining);
  if (typeof reset === "number") headers["X-RateLimit-Reset"] = String(reset);
  return headers;
}

export async function GET(req: Request): Promise<Response> {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    const rate = await readLimiter.limit(getReadRateLimitKey(ip));
    if (!rate.success) {
      return Response.json(
        { error: "Too many requests" },
        { status: 429, headers: buildRateHeaders(rate.limit, rate.remaining, rate.reset) }
      );
    }

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
    logger.error("Error in pricing API:", error);
    return Response.json(
      { error: "Failed to fetch pricing data" },
      { status: 500 }
    );
  }
}
