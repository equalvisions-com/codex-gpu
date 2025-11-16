import * as React from "react";
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import { ModelsClient } from "@/components/models-table/models-client";
import { modelsDataOptions } from "@/components/models-table/models-query-options";
import { modelsSearchParamsCache } from "@/components/models-table/models-search-params";
import { getModelsPage } from "@/lib/models-loader";

export const revalidate = 43200;

interface ModelsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function normalizeModelsSearchParams(
  input: Record<string, string | string[] | undefined>,
) {
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") {
      normalized[key] = value;
      continue;
    }

    if (Array.isArray(value) && value.length > 0) {
      normalized[key] = value[0] ?? "";
    }
  }

  return normalized;
}

export default function ModelsPage({ searchParams }: ModelsPageProps) {
  return <ModelsHydratedContent searchParams={searchParams} />;
}

async function ModelsHydratedContent({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = normalizeModelsSearchParams(
    (await searchParams) ?? {},
  );
  const parsedSearch = modelsSearchParamsCache.parse(resolvedSearchParams);

  const queryClient = new QueryClient();

  if (parsedSearch.favorites !== "true") {
    try {
      const infiniteOptions = modelsDataOptions(parsedSearch);
      await queryClient.prefetchInfiniteQuery({
        ...infiniteOptions,
        queryFn: async ({ pageParam }) => {
          const cursor =
            typeof pageParam?.cursor === "number" ? pageParam.cursor : null;
          const size =
            (pageParam as { size?: number } | undefined)?.size ??
            parsedSearch.size ??
            50;
          return getModelsPage({
            ...parsedSearch,
            cursor,
            size,
            uuid: null,
          });
        },
      });
    } catch (error) {
      console.error("[ModelsPage] Failed to prefetch models data", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <div
        className="flex min-h-dvh w-full flex-col sm:flex-row pt-2 sm:p-0"
        style={{
          "--total-padding-mobile": "calc(0.5rem + 0.5rem)",
          "--total-padding-desktop": "3rem",
        } as React.CSSProperties}
      >
        <ModelsClient />
      </div>
    </HydrationBoundary>
  );
}
