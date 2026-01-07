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

const HOME_META_TITLE = "GPU Pricing Explorer | Deploybase";
const HOME_META_DESCRIPTION =
  "Compare hourly GPU prices, VRAM, and provider availability with our infinite data table powered by TanStack Table, nuqs, and shadcn/ui.";
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
  return <HomeGpusContent />;
}

async function HomeGpusContent() {
  const parsedSearch = searchParamsCache.parse({});
  const queryClient = new QueryClient();
  let firstPagePayload: Awaited<ReturnType<typeof getGpuPricingPage>> | null =
    null;

  if (parsedSearch.bookmarks !== "true") {
    try {
      const infiniteOptions = dataOptions(parsedSearch);
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
      console.error("[HomePage] Failed to prefetch GPU data", {
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

