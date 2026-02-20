import type {
  ToolInfiniteQueryResponse,
  ToolLogsMeta,
} from "@/features/data-explorer/tools/tools-query-options";
import type { ToolColumnSchema } from "@/features/data-explorer/tools/tools-schema";
import { toolsSearchParamsCache } from "@/features/data-explorer/tools/tools-search-params";
import type { ToolsSearchParamsType } from "@/features/data-explorer/tools/tools-search-params";
import { getToolsPage } from "@/lib/tools-loader";
import { logger } from "@/lib/logger";
import { getRequestLogContext } from "@/lib/request-log-context";
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
    const requestUrl = new URL(req.url);
    const _search: Map<string, string> = new Map();
    requestUrl.searchParams.forEach((value, key) => _search.set(key, value));

    const search: ToolsSearchParamsType = toolsSearchParamsCache.parse(Object.fromEntries(_search));

    const t1 = Date.now();
    const result = await getToolsPage(search);
    const res = Response.json(result satisfies ToolInfiniteQueryResponse<ToolColumnSchema[], ToolLogsMeta>);
    logger.info({
      event: "api.tools.page",
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
    logger.error("Error in tools API:", error);
    return Response.json(
      { error: "Failed to fetch tools data" },
      { status: 500 },
    );
  }
}
