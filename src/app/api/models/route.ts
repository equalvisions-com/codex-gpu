import type { ModelsInfiniteQueryResponse, ModelsLogsMeta } from "@/features/data-explorer/models/models-query-options";
import type { ModelsColumnSchema } from "@/features/data-explorer/models/models-schema";
import { modelsSearchParamsCache } from "@/features/data-explorer/models/models-search-params";
import type { ModelsSearchParamsType } from "@/features/data-explorer/models/models-search-params";
import { logger } from "@/lib/logger";
import { getRequestLogContext } from "@/lib/request-log-context";
import { getModelsPage } from "@/lib/models-loader";
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

    const search: ModelsSearchParamsType =
      modelsSearchParamsCache.parse(Object.fromEntries(_search));
    const t1 = Date.now();
    const response = await getModelsPage(search);
    const res = Response.json(
      response satisfies ModelsInfiniteQueryResponse<
        ModelsColumnSchema[],
        ModelsLogsMeta
      >,
    );

    logger.info({
      event: "api.models.page",
      cursor: search.cursor ?? 0,
      size: search.size ?? 50,
      rowsReturned: response.data.length,
      nextCursor: response.nextCursor,
      filterCount: response.meta.filterRowCount,
      latencyMs: Date.now() - t1,
      ...logContext,
    });

    return res;
  } catch (error) {
    logger.error("Error in models API:", error);
    return Response.json(
      { error: "Failed to fetch models data" },
      { status: 500 },
    );
  }
}
