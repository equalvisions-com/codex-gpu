import type { ModelsInfiniteQueryResponse, ModelsLogsMeta } from "@/components/models-table/models-query-options";
import type { ModelsColumnSchema } from "@/components/models-table/models-schema";
import { modelsSearchParamsCache } from "@/components/models-table/models-search-params";
import type { ModelsSearchParamsType } from "@/components/models-table/models-search-params";
import { logger } from "@/lib/logger";
import { getModelsPage } from "@/lib/models-loader";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  try {
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

    logger.info(
      JSON.stringify({
        event: "api.models.page",
        cursor: search.cursor ?? 0,
        size: search.size ?? 50,
        rowsReturned: response.data.length,
        nextCursor: response.nextCursor,
        filterCount: response.meta.filterRowCount,
        latencyMs: Date.now() - t1,
      }),
    );

    return res;
  } catch (error) {
    console.error("Models API error:", error);
    return Response.json(
      { error: "Failed to fetch models data" },
      { status: 500 },
    );
  }
}
