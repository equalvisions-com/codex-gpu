import type { Percentile } from "@/lib/request/percentile";
import { infiniteQueryOptions } from "@tanstack/react-query";
import type {
  CpuColumnSchema,
  CpuFacetMetadataSchema,
} from "./cpu-schema";
import { cpuSearchParamsSerializer, type CpuSearchParamsType } from "./cpu-search-params";

export type CpuLogsMeta = {
  // For CPU pricing, we might add different metadata later
};

export type CpuInfiniteQueryMeta<TMeta = Record<string, unknown>> = {
  totalRowCount: number;
  filterRowCount: number;
  facets: Record<string, CpuFacetMetadataSchema>;
  metadata?: TMeta;
};

export type CpuInfiniteQueryResponse<TData, TMeta = unknown> = {
  data: TData;
  meta: CpuInfiniteQueryMeta<TMeta>;
  prevCursor: number | null;
  nextCursor: number | null;
};

export const cpuDataOptions = (search: CpuSearchParamsType) => {
  return infiniteQueryOptions({
    queryKey: [
      "cpu-data-table",
      cpuSearchParamsSerializer({ ...search, uuid: null }),
    ],
    queryFn: async ({ pageParam }) => {
      const query = cpuSearchParamsSerializer({
        ...search,
        cursor: pageParam?.cursor ?? null,
        start: pageParam?.cursor ? (undefined as unknown as number) : 0,
        size: pageParam?.size,
        uuid: null,
      });
      const response = await fetch(`/api/cpu${query}`, {
        next: { revalidate: 900, tags: ["pricing"] },
      });
      const json = await response.json();
      return json as CpuInfiniteQueryResponse<CpuColumnSchema[], CpuLogsMeta>;
    },
    initialPageParam: { cursor: null as number | null, size: search.size ?? 50 },
    getNextPageParam: (lastPage) => lastPage.nextCursor
      ? { cursor: lastPage.nextCursor, size: search.size ?? 50 }
      : null,
    refetchOnWindowFocus: false,
  });
};
