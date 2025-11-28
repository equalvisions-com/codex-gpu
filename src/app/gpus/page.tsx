import type { Metadata } from "next";
import * as React from "react";
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import { Client } from "@/features/data-explorer/table/client";
import { dataOptions } from "@/features/data-explorer/table/query-options";
import { searchParamsCache } from "@/features/data-explorer/table/search-params";
import { getGpuPricingPage } from "@/lib/gpu-pricing-loader";
import { buildGpuSchema } from "@/features/data-explorer/table/gpu-schema";

export const revalidate = 43200;

const GPU_META_TITLE = "GPU Pricing Explorer | Deploybase";
const GPU_META_DESCRIPTION =
  "Compare hourly GPU prices, VRAM, and provider availability with our infinite data table powered by TanStack Table, nuqs, and shadcn/ui.";
const SHARED_OG_IMAGE = "/assets/data-table-infinite.png";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: GPU_META_TITLE,
    description: GPU_META_DESCRIPTION,
    openGraph: {
      title: GPU_META_TITLE,
      description: GPU_META_DESCRIPTION,
      images: [SHARED_OG_IMAGE],
      url: "/gpus",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: GPU_META_TITLE,
      description: GPU_META_DESCRIPTION,
      images: [SHARED_OG_IMAGE],
    },
  };
}

// ISR-friendly route: we seed React Query with the default (unfiltered) data.
// Client-side nuqs manages URL-bound filters after hydration to keep SSR static.
export default function GpusPage() {
  return <GpusHydratedContent />;
}

async function GpusHydratedContent() {
  const parsedSearch = searchParamsCache.parse({});
  // Use new QueryClient for ISR - each page render gets fresh client
  // This is correct for server-side prefetching per TanStack Query docs
  const queryClient = new QueryClient();
  let firstPagePayload: Awaited<ReturnType<typeof getGpuPricingPage>> | null =
    null;

  if (parsedSearch.bookmarks !== "true") {
    try {
      const infiniteOptions = dataOptions(parsedSearch);
      // Prefetch using loader directly (more performant for ISR - no HTTP overhead)
      // Client will use API routes for subsequent pagination
      await queryClient.prefetchInfiniteQuery({
        ...infiniteOptions,
        queryFn: async ({ pageParam }) => {
          const cursor =
            typeof pageParam?.cursor === "number" ? pageParam.cursor : null;
          const size =
            (pageParam as { size?: number } | undefined)?.size ??
            parsedSearch.size ??
            50;
          const result = await getGpuPricingPage({
            ...parsedSearch,
            cursor,
            size,
            uuid: null,
          });
          if (!firstPagePayload && (cursor === null || cursor === 0)) {
            firstPagePayload = result;
          }
          return result;
        },
      });
    } catch (error) {
      console.error("[GpusPage] Failed to prefetch GPU data", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

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
