import * as React from "react";
import { Suspense } from "react";
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
  type DehydratedState,
} from "@tanstack/react-query";
import { Loader } from "lucide-react";
import { ModelsClient } from "@/components/models-table/models-client";
import { modelsDataOptions } from "@/components/models-table/models-query-options";
import { modelsSearchParamsCache } from "@/components/models-table/models-search-params";

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

export default async function ModelsPage({ searchParams }: ModelsPageProps) {
  const resolvedSearchParams = normalizeModelsSearchParams(
    (await searchParams) ?? {},
  );
  const parsedSearch = modelsSearchParamsCache.parse(resolvedSearchParams);

  const queryClient = new QueryClient();

  if (parsedSearch.favorites !== "true") {
    try {
      await queryClient.prefetchInfiniteQuery(modelsDataOptions(parsedSearch));
    } catch (error) {
      console.error("[ModelsPage] Failed to prefetch models data", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const dehydratedState = dehydrate(queryClient);

  return (
    <Suspense fallback={<PageFallback />}>
      <ModelsContent dehydratedState={dehydratedState} />
    </Suspense>
  );
}

function ModelsContent({
  dehydratedState,
}: {
  dehydratedState: DehydratedState;
}) {
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

function PageFallback() {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center">
      <span className="inline-flex items-center justify-center text-muted-foreground" aria-label="Loading">
        <Loader className="h-8 w-8 animate-spin text-foreground/70" strokeWidth={1.5} />
        <span className="sr-only">Loading</span>
      </span>
    </div>
  );
}
