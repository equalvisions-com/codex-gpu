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

export const revalidate = 43200;

const HOME_META_TITLE = "Deploybase | LLM Benchmark Explorer";
const HOME_META_DESCRIPTION =
  "Benchmark large language models by latency, throughput, modality support, and pricing with our interactive data explorer.";
const SHARED_OG_IMAGE = "/assets/data-table-infinite.png";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: HOME_META_TITLE,
    description: HOME_META_DESCRIPTION,
    openGraph: {
      title: HOME_META_TITLE,
      description: HOME_META_DESCRIPTION,
      url: "/",
      images: [SHARED_OG_IMAGE],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: HOME_META_TITLE,
      description: HOME_META_DESCRIPTION,
      images: [SHARED_OG_IMAGE],
    },
  };
}

export default function HomePage() {
  return <HomeLlmsContent />;
}

async function HomeLlmsContent() {
  const parsedSearch = modelsSearchParamsCache.parse({});
  const queryClient = new QueryClient();
  let firstPagePayload: Awaited<ReturnType<typeof getModelsPage>> | null = null;

  if (parsedSearch.bookmarks !== "true") {
    try {
      const infiniteOptions = modelsDataOptions(parsedSearch);
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
          if (!firstPagePayload && (cursor === null || cursor === 0)) {
            firstPagePayload = result;
          }
          return result;
        },
      });
    } catch (error) {
      console.error("[HomePage] Failed to prefetch models data", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

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
