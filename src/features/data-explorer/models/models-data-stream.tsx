import { Suspense } from "react";
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import { modelsSearchParamsCache } from "./models-search-params";
import { modelsDataOptions } from "./models-query-options";
import { getModelsPage } from "@/lib/models-loader";
import { ModelsClient } from "./models-client";
import { ModelsTableSkeleton } from "./models-table-skeleton";
import { buildModelsSchema } from "./models-schema";

export async function ModelsDataStream() {
  const parsedSearch = modelsSearchParamsCache.parse({});
  const queryClient = new QueryClient();

  // Fetch data - this will stream in
  const firstPagePayload = await getModelsPage({
    ...parsedSearch,
    cursor: null,
    size: parsedSearch.size ?? 50,
    uuid: null,
  });

  // Prefetch for React Query hydration
  await queryClient.prefetchInfiniteQuery({
    ...modelsDataOptions(parsedSearch),
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

  const dehydratedState = dehydrate(queryClient);
  const schemaMarkup = buildModelsSchema(firstPagePayload);

  return (
    <HydrationBoundary state={dehydratedState}>
      {schemaMarkup ? (
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schemaMarkup).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}
      <ModelsClient />
    </HydrationBoundary>
  );
}

export function ModelsDataStreamWithSuspense() {
  return (
    <Suspense fallback={<ModelsTableSkeleton />}>
      <ModelsDataStream />
    </Suspense>
  );
}

