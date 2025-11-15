import * as React from "react";
import { Suspense } from "react";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { Client } from "@/components/infinite-table/client";
import {
  searchParamsCache,
  type SearchParamsType,
} from "@/components/infinite-table/search-params";
import { dataOptions } from "@/components/infinite-table/query-options";
import { makeQueryClient } from "@/providers/get-query-client";

export const revalidate = 43200;

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GpusPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const parsedSearch = parseSearchParams(resolvedSearchParams);
  const queryClient = await getPrefetchedQueryClient(parsedSearch);
  const dehydratedState = dehydrate(queryClient);

  return (
    <Suspense fallback={<PageFallback />}>
      <HydrationBoundary state={dehydratedState}>
        <GpusContent />
      </HydrationBoundary>
    </Suspense>
  );
}

function GpusContent() {
  return (
    <div
      className="flex min-h-dvh w-full flex-col sm:flex-row pt-2 sm:p-0"
      style={{
        "--total-padding-mobile": "calc(0.5rem + 0.5rem)",
        "--total-padding-desktop": "3rem",
      } as React.CSSProperties}
    >
      <Client />
    </div>
  );
}

function PageFallback() {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center text-sm text-muted-foreground">

    </div>
  );
}

function parseSearchParams(
  searchParams?: Record<string, string | string[] | undefined>,
): SearchParamsType {
  const urlSearchParams = new URLSearchParams();
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (Array.isArray(value)) {
        value.forEach((entry) => {
          if (typeof entry === "string") {
            urlSearchParams.append(key, entry);
          }
        });
      } else if (typeof value === "string") {
        urlSearchParams.set(key, value);
      }
    }
  }

  return searchParamsCache.parse(
    Object.fromEntries(urlSearchParams.entries()),
  );
}

async function getPrefetchedQueryClient(search: SearchParamsType) {
  const queryClient = makeQueryClient();
  await queryClient.prefetchInfiniteQuery(dataOptions(search));
  return queryClient;
}
