import { infiniteQueryOptions } from "@tanstack/react-query";
import type {
  ColumnSchema,
  FacetMetadataSchema,
} from "./schema";
import {
  searchParamsSerializer,
  type SearchParamsType,
} from "./search-params";
import { fetchJson } from "@/lib/fetch-json";

export type LogsMeta = {
  // For GPU pricing, we might add different metadata later
};

type InfiniteQueryMeta<TMeta = Record<string, unknown>> = {
  totalRowCount: number;
  filterRowCount: number;
  facets: Record<string, FacetMetadataSchema>;
  metadata?: TMeta;
};

export type InfiniteQueryResponse<TData, TMeta = unknown> = {
  data: TData;
  meta: InfiniteQueryMeta<TMeta>;
  prevCursor: number | null;
  nextCursor: number | null;
};

export const dataOptions = (search: SearchParamsType) => {
  return infiniteQueryOptions({
    queryKey: [
      "data-table",
      searchParamsSerializer({ ...search, uuid: null }),
    ],
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam?.cursor ?? undefined;
      const serialize = searchParamsSerializer({
        ...search,
        cursor,
        uuid: null,
      });
      return fetchJson<InfiniteQueryResponse<ColumnSchema[], LogsMeta>>(`/api${serialize}`);
    },
    initialPageParam: { cursor: null as number | null, size: search.size ?? 50 },
    getNextPageParam: (lastPage) => lastPage.nextCursor
      ? { cursor: lastPage.nextCursor, size: search.size ?? 50 }
      : null,
    refetchOnWindowFocus: false,
  });
};
