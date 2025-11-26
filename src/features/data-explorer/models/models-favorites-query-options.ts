import { infiniteQueryOptions } from "@tanstack/react-query";
import type {
  ModelsColumnSchema,
} from "./models-schema";
import { modelsSearchParamsSerializer, type ModelsSearchParamsType } from "./models-search-params";
import { getModelFavoriteRows } from "@/lib/model-favorites/api-client";
import type { ModelsInfiniteQueryResponse, ModelsLogsMeta } from "./models-query-options";

export const favoritesDataOptions = (search: ModelsSearchParamsType) => {
  return infiniteQueryOptions({
    queryKey: [
      "model-favorites",
      "rows",
      modelsSearchParamsSerializer({ ...search, uuid: null }),
    ],
    queryFn: async ({ pageParam }) => {
      const serializedSearch = modelsSearchParamsSerializer({
        ...search,
        cursor: pageParam?.cursor ?? null,
        size: pageParam?.size ?? search.size,
        uuid: null,
      });
      return getModelFavoriteRows(serializedSearch) as Promise<ModelsInfiniteQueryResponse<ModelsColumnSchema[], ModelsLogsMeta>>;
    },
    initialPageParam: { cursor: null as number | null, size: search.size ?? 50 },
    getNextPageParam: (lastPage) => lastPage.nextCursor
      ? { cursor: lastPage.nextCursor, size: search.size ?? 50 }
      : null,
    refetchOnWindowFocus: false,
    refetchOnMount: "always", // Always refetch when mounting favorites view
  });
};
