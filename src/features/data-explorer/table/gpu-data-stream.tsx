import {
  HydrationBoundary,
  dehydrate,
} from "@tanstack/react-query";
import { searchParamsCache } from "./search-params";
import { dataOptions } from "./query-options";
import { getGpuPricingPage } from "@/lib/gpu-pricing-loader";
import { Client } from "./client";
import { buildGpuSchema } from "./gpu-schema";
import { getQueryClient } from "@/providers/get-query-client";

// This component becomes dynamic when it accesses searchParams
// The parent page shell remains static and prerendered
export async function GpuDataStreamInner({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const parsedSearch = searchParamsCache.parse(params);
  const queryClient = getQueryClient();

  // Fetch data once - reuse for both schema and React Query hydration
  const firstPagePayload = await getGpuPricingPage({
    ...parsedSearch,
    cursor: null,
    size: parsedSearch.size ?? 50,
    uuid: null,
  });

  // Prefetch for React Query hydration - reuse firstPagePayload for initial page
  await queryClient.prefetchInfiniteQuery({
    ...dataOptions(parsedSearch),
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
      return getGpuPricingPage({
        ...parsedSearch,
        cursor,
        size,
        uuid: null,
      });
    },
  });

  const dehydratedState = dehydrate(queryClient);
  const schemaMarkup = buildGpuSchema(firstPagePayload);

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
      <Client />
    </HydrationBoundary>
  );
}


