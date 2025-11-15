import { infiniteQueryOptions } from "@tanstack/react-query";
import { fetchJson } from "@/lib/fetch-json";
import type {
  ModelsColumnSchema,
  ModelsFacetMetadataSchema,
} from "./models-schema";
import {
  modelsSearchParamsSerializer,
  type ModelsSearchParamsType,
} from "./models-search-params";

export type ModelsLogsMeta = {
  // For AI models, we might add different metadata later
};

type ModelsInfiniteQueryMeta<TMeta = Record<string, unknown>> = {
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
      const cursor = pageParam?.cursor ?? undefined;
      const query = modelsSearchParamsSerializer({
        ...search,
        cursor,
        uuid: null,
      });
      const fetchInit =
        typeof window === "undefined"
          ? {
              next: {
                revalidate: 43200,
                tags: ["models"],
              },
            }
          : undefined;
      return fetchJson<ModelsInfiniteQueryResponse<ModelsColumnSchema[], ModelsLogsMeta>>(
        `/api/models${query}`,
        fetchInit,
      );
    },
    initialPageParam: { cursor: null as number | null, size: search.size ?? 50 },
    getNextPageParam: (lastPage) => lastPage.nextCursor
      ? { cursor: lastPage.nextCursor, size: search.size ?? 50 }
      : null,
    refetchOnWindowFocus: false,
  });
};

// Separate query for facets (doesn't depend on filters - always shows all options)
