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

export async function GET(req: Request): Promise<Response> {
  try {
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
    console.error("Error in tools API:", error);
    return Response.json(
      {
        error: "Failed to fetch tools data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
