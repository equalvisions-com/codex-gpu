import type { Metadata } from "next";
import * as React from "react";
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import { ModelsClient } from "@/features/data-explorer/models/models-client";
import { modelsDataOptions } from "@/features/data-explorer/models/models-query-options";
import { modelsSearchParamsCache } from "@/features/data-explorer/models/models-search-params";
import { getModelsPage } from "@/lib/models-loader";
import { buildModelsSchema } from "@/features/data-explorer/models/build-models-schema";
import { logger } from "@/lib/logger";

export const revalidate = 43200;

const LLMS_META_TITLE = "LLM Benchmark Explorer | Deploybase";
const LLMS_META_DESCRIPTION =
  "Filter and benchmark large language models by latency, throughput, modality support, and pricing using our interactive table experience.";
const SHARED_OG_IMAGE = "/assets/data-table-infinite.png";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: LLMS_META_TITLE,
    description: LLMS_META_DESCRIPTION,
    openGraph: {
      title: LLMS_META_TITLE,
      description: LLMS_META_DESCRIPTION,
      url: "/llms",
      images: [SHARED_OG_IMAGE],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: LLMS_META_TITLE,
      description: LLMS_META_DESCRIPTION,
      images: [SHARED_OG_IMAGE],
    },
  };
}

// ISR-friendly route: we seed React Query with the default (unfiltered) data.
// Client-side nuqs manages URL-bound filters after hydration to keep SSR static.
export default function ModelsPage() {
  return <ModelsHydratedContent />;
}

async function ModelsHydratedContent() {
  const parsedSearch = modelsSearchParamsCache.parse({});
  // Use new QueryClient for ISR - each page render gets fresh client
  // This is correct for server-side prefetching per TanStack Query docs
  const queryClient = new QueryClient();
  const captured: { firstPage: Awaited<ReturnType<typeof getModelsPage>> | null } = { firstPage: null };

  if (parsedSearch.bookmarks !== "true") {
    try {
      const infiniteOptions = modelsDataOptions(parsedSearch);
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
          const result = await getModelsPage({
            ...parsedSearch,
            cursor,
            size,
            uuid: null,
          });
          if (!captured.firstPage && (cursor === null || cursor === 0)) {
            captured.firstPage = result;
          }
          return result;
        },
      });
    } catch (error) {
      logger.error("[ModelsPage] Failed to prefetch models data", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const dehydratedState = dehydrate(queryClient);
  const schemaMarkup = buildModelsSchema(captured.firstPage);

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
        <ModelsClient />
      </div>
    </HydrationBoundary>
  );
}
