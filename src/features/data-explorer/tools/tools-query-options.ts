import { infiniteQueryOptions } from "@tanstack/react-query";
import { fetchJson } from "@/lib/fetch-json";
import type { ToolColumnSchema, ToolsFacetMetadataSchema } from "./tools-schema";
import {
  toolsSearchParamsSerializer,
  type ToolsSearchParamsType,
} from "./tools-search-params";

export type ToolLogsMeta = Record<string, unknown>;

type ToolInfiniteQueryMeta<TMeta = Record<string, unknown>> = {
  totalRowCount: number;
  filterRowCount: number;
  facets: Record<string, ToolsFacetMetadataSchema>;
  metadata?: TMeta;
};

export type ToolInfiniteQueryResponse<TData, TMeta = unknown> = {
  data: TData;
  meta: ToolInfiniteQueryMeta<TMeta>;
  prevCursor: number | null;
  nextCursor: number | null;
};

export const toolsDataOptions = (search: ToolsSearchParamsType) => {
  return infiniteQueryOptions({
    queryKey: ["tools-data-table", toolsSearchParamsSerializer({ ...search, uuid: null })],
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam?.cursor ?? undefined;
      const query = toolsSearchParamsSerializer({ ...search, cursor, uuid: null });
      return fetchJson<ToolInfiniteQueryResponse<ToolColumnSchema[], ToolLogsMeta>>(`/api/tools${query}`);
    },
    initialPageParam: { cursor: null as number | null, size: search.size ?? 50 },
    getNextPageParam: (lastPage) =>
      lastPage.nextCursor ? { cursor: lastPage.nextCursor, size: search.size ?? 50 } : null,
    refetchOnWindowFocus: false,
  });
};
