import { Suspense } from "react";
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import { searchParamsCache } from "./search-params";
import { dataOptions } from "./query-options";
import { getGpuPricingPage } from "@/lib/gpu-pricing-loader";
import { Client } from "./client";
import { TableSkeleton } from "./table-skeleton";
import { buildGpuSchema } from "./gpu-schema";

async function GpuDataStreamInner() {
  const parsedSearch = searchParamsCache.parse({});
  const queryClient = new QueryClient();

  // Fetch data - this will stream in
  const firstPagePayload = await getGpuPricingPage({
    ...parsedSearch,
    cursor: null,
    size: parsedSearch.size ?? 50,
    uuid: null,
  });

  // Prefetch for React Query hydration
  await queryClient.prefetchInfiniteQuery({
    ...dataOptions(parsedSearch),
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

export function GpuDataStreamWithSuspense() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <GpuDataStreamInner />
    </Suspense>
  );
}

