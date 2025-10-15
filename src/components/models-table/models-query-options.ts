import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import type {
  ModelsColumnSchema,
  ModelsFacetMetadataSchema,
} from "./models-schema";
import { modelsSearchParamsSerializer, type ModelsSearchParamsType } from "./models-search-params";

export type ModelsLogsMeta = {
  // For AI models, we might add different metadata later
};

export type ModelsInfiniteQueryMeta<TMeta = Record<string, unknown>> = {
  totalRowCount: number;
  filterRowCount: number;
  facets: Record<string, ModelsFacetMetadataSchema>;
  metadata?: TMeta;
};

export type ModelsInfiniteQueryResponse<TData, TMeta = unknown> = {
  data: TData;
  meta: ModelsInfiniteQueryMeta<TMeta>;
  prevCursor: number | null;
  nextCursor: number | null;
};

export const modelsDataOptions = (search: ModelsSearchParamsType) => {
  return infiniteQueryOptions({
    queryKey: [
      "models-data-table",
      modelsSearchParamsSerializer({ ...search, uuid: null }),
    ],
    queryFn: async ({ pageParam }) => {
      const query = modelsSearchParamsSerializer({
        ...search,
        cursor: pageParam?.cursor ?? null,
        start: pageParam?.cursor ? (undefined as unknown as number) : 0,
        size: pageParam?.size,
        uuid: null,
      });
      const response = await fetch(`/api/models${query}`, {
        next: { revalidate: 3600, tags: ["models"] }, // Revalidate every hour
      });
      const json = await response.json();
      return json as ModelsInfiniteQueryResponse<ModelsColumnSchema[], ModelsLogsMeta>;
    },
    initialPageParam: { cursor: null as number | null, size: search.size ?? 50 },
    getNextPageParam: (lastPage) => lastPage.nextCursor
      ? { cursor: lastPage.nextCursor, size: search.size ?? 50 }
      : null,
    refetchOnWindowFocus: false,
  });
};

// Separate query for facets (doesn't depend on filters - always shows all options)
export const modelsFacetsOptions = () => {
  return queryOptions({
    queryKey: ["models-facets"],
    queryFn: async () => {
      // Request facets only (no filters applied)
      const response = await fetch(`/api/models?size=1`, {
        next: { revalidate: 3600, tags: ["models"] },
      });
      const json = await response.json();
      return json.meta.facets as Record<string, ModelsFacetMetadataSchema>;
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // Consider facets fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
};
