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

export async function ModelsDataStreamInner() {
  const parsedSearch = modelsSearchParamsCache.parse({});
  const queryClient = getQueryClient();

  // Fetch data once - reuse for both schema and React Query hydration
  const firstPagePayload = await getModelsPage({
    ...parsedSearch,
    cursor: null,
    size: parsedSearch.size ?? 50,
    uuid: null,
  });

  // Prefetch for React Query hydration - reuse firstPagePayload for initial page
  await queryClient.prefetchInfiniteQuery({
    ...modelsDataOptions(parsedSearch),
    queryFn: async ({ pageParam }) => {
      const cursor =
        typeof pageParam?.cursor === "number" ? pageParam.cursor : null;
      const size =
        (pageParam as { size?: number } | undefined)?.size ??
        parsedSearch.size ??
        50;
      
      // Reuse the already-fetched first page payload
      if (cursor === null || cursor === 0) {
        return firstPagePayload;
      }
      
      // Fetch subsequent pages
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


