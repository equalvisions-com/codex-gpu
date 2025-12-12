import { infiniteQueryOptions } from "@tanstack/react-query";
import type { ToolColumnSchema } from "./tools-schema";
import { toolsSearchParamsSerializer, type ToolsSearchParamsType } from "./tools-search-params";
import { getToolFavoriteRows } from "@/lib/tool-favorites/api-client";
import type { ToolInfiniteQueryResponse, ToolLogsMeta } from "./tools-query-options";

export const toolFavoritesDataOptions = (search: ToolsSearchParamsType) => {
  return infiniteQueryOptions({
    queryKey: ["tool-favorites", "rows", toolsSearchParamsSerializer({ ...search, uuid: null })],
    queryFn: async ({ pageParam }) => {
      const serializedSearch = toolsSearchParamsSerializer({
        ...search,
        cursor: pageParam?.cursor ?? null,
        size: pageParam?.size ?? search.size,
        uuid: null,
      });
      return getToolFavoriteRows(serializedSearch) as Promise<
        ToolInfiniteQueryResponse<ToolColumnSchema[], ToolLogsMeta>
      >;
    },
    initialPageParam: { cursor: null as number | null, size: search.size ?? 50 },
    getNextPageParam: (lastPage) =>
      lastPage.nextCursor ? { cursor: lastPage.nextCursor, size: search.size ?? 50 } : null,
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
  });
};
