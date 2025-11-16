import * as React from "react";
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import { Client } from "@/components/infinite-table/client";
import { dataOptions } from "@/components/infinite-table/query-options";
import { searchParamsCache } from "@/components/infinite-table/search-params";
import { getGpuPricingPage } from "@/lib/gpu-pricing-loader";

export const revalidate = 43200;

interface GpusPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function normalizeSearchParams(
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

export default function GpusPage({ searchParams }: GpusPageProps) {
  return <GpusHydratedContent searchParams={searchParams} />;
}

async function GpusHydratedContent({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = normalizeSearchParams(
    (await searchParams) ?? {},
  );
  const parsedSearch = searchParamsCache.parse(resolvedSearchParams);

  const queryClient = new QueryClient();

  if (parsedSearch.favorites !== "true") {
    try {
      const infiniteOptions = dataOptions(parsedSearch);
      await queryClient.prefetchInfiniteQuery({
        ...infiniteOptions,
        queryFn: async ({ pageParam }) => {
          const cursor =
            typeof pageParam?.cursor === "number" ? pageParam.cursor : null;
          const size =
            (pageParam as { size?: number } | undefined)?.size ??
            parsedSearch.size ??
            50;
          return getGpuPricingPage({
            ...parsedSearch,
            cursor,
            size,
            uuid: null,
          });
        },
      });
    } catch (error) {
      console.error("[GpusPage] Failed to prefetch GPU data", {
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
        <Client />
      </div>
    </HydrationBoundary>
  );
}
