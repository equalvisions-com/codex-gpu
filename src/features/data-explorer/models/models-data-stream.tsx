import {
  HydrationBoundary,
  dehydrate,
} from "@tanstack/react-query";
import { modelsSearchParamsCache } from "./models-search-params";
import { modelsDataOptions } from "./models-query-options";
import { getModelsPage } from "@/lib/models-loader";
import { ModelsClient } from "./models-client";
import { buildModelsSchema } from "./build-models-schema";
import { getQueryClient } from "@/providers/get-query-client";

// This component becomes dynamic when it accesses searchParams
// The parent page shell remains static and prerendered
export async function ModelsDataStreamInner({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const parsedSearch = modelsSearchParamsCache.parse(params);
  const queryClient = getQueryClient();

  // Fetch data once - reuse for both schema and React Query hydration
  const firstPagePayload = await getModelsPage({
    ...parsedSearch,
    cursor: null,
    size: parsedSearch.size ?? 50,
    uuid: null,
  });

  // Get query options to ensure exact queryKey match with client
  const queryOptions = modelsDataOptions(parsedSearch);
  const initialPageParam = queryOptions.initialPageParam;

  // Set first page data directly using setQueryData for exact structure match
  // This ensures the queryKey and data structure match exactly what the client expects
  // Reuses firstPagePayload to avoid double fetching
  // Using setQueryData instead of prefetchInfiniteQuery ensures exact consistency
  // with the client's queryFn while maintaining optimization
  queryClient.setQueryData(queryOptions.queryKey, {
    pages: [firstPagePayload],
    pageParams: [initialPageParam],
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


