import * as React from "react";
import { Suspense } from "react";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { ModelsClient } from "@/components/models-table/models-client";
import {
  modelsSearchParamsCache,
  type ModelsSearchParamsType,
} from "@/components/models-table/models-search-params";
import { modelsDataOptions } from "@/components/models-table/models-query-options";
import { makeQueryClient } from "@/providers/get-query-client";

export const revalidate = 43200;

type PageSearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
  searchParams?: PageSearchParams | Promise<PageSearchParams>;
};

export default async function ModelsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const parsedSearch = parseSearchParams(resolvedSearchParams);
  const queryClient = await getPrefetchedQueryClient(parsedSearch);
  const dehydratedState = dehydrate(queryClient);

  return (
    <Suspense fallback={<PageFallback />}>
      <HydrationBoundary state={dehydratedState}>
        <ModelsContent />
      </HydrationBoundary>
    </Suspense>
  );
}

function ModelsContent() {
  return (
    <div
      className="flex min-h-dvh w-full flex-col sm:flex-row pt-2 sm:p-0"
      style={{
        "--total-padding-mobile": "calc(0.5rem + 0.5rem)",
        "--total-padding-desktop": "3rem",
      } as React.CSSProperties}
    >
      <ModelsClient />
    </div>
  );
}

function PageFallback() {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center text-sm text-muted-foreground">
    </div>
  );
}

async function resolveSearchParams(
  searchParams?: PageSearchParams | Promise<PageSearchParams>,
) {
  if (!searchParams) {
    return undefined;
  }

  if (typeof (searchParams as Promise<PageSearchParams>).then === "function") {
    return await (searchParams as Promise<PageSearchParams>);
  }

  return searchParams as PageSearchParams;
}

function parseSearchParams(
  searchParams?: PageSearchParams,
): ModelsSearchParamsType {
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

  return modelsSearchParamsCache.parse(
    Object.fromEntries(urlSearchParams.entries()),
  );
}

async function getPrefetchedQueryClient(search: ModelsSearchParamsType) {
  const queryClient = makeQueryClient();
  await queryClient.prefetchInfiniteQuery(modelsDataOptions(search));
  return queryClient;
}
