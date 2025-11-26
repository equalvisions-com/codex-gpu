import { infiniteQueryOptions } from "@tanstack/react-query";
import type { ColumnSchema } from "./schema";
import { searchParamsSerializer, type SearchParamsType } from "./search-params";
import { getFavoriteRows } from "@/lib/favorites/api-client";
import type { InfiniteQueryResponse, LogsMeta } from "./query-options";

export const favoritesDataOptions = (search: SearchParamsType) => {
  return infiniteQueryOptions({
    queryKey: [
      "favorites",
      "rows",
      searchParamsSerializer({ ...search, uuid: null }),
    ],
    queryFn: async ({ pageParam }) => {
      const serializedSearch = searchParamsSerializer({
        ...search,
        cursor: pageParam?.cursor ?? null,
        size: pageParam?.size ?? search.size,
        uuid: null,
      });
      return getFavoriteRows(serializedSearch) as Promise<InfiniteQueryResponse<ColumnSchema[], LogsMeta>>;
    },
    initialPageParam: { cursor: null as number | null, size: search.size ?? 50 },
    getNextPageParam: (lastPage) => lastPage.nextCursor
      ? { cursor: lastPage.nextCursor, size: search.size ?? 50 }
      : null,
    refetchOnWindowFocus: false,
    refetchOnMount: "always", // Always refetch when mounting favorites view
  });
};
