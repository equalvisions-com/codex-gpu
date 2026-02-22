import type { Metadata } from "next";
import * as React from "react";
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import { dataOptions } from "@/features/data-explorer/table/query-options";
import { ProviderGpuClient } from "./provider-gpu-client";
import { searchParamsCache } from "@/features/data-explorer/table/search-params";
import { getGpuPricingPage } from "@/lib/gpu-pricing-loader";
import { buildGpuSchema } from "@/features/data-explorer/table/gpu-schema";
import { logger } from "@/lib/logger";

export const revalidate = 43200;

const KNOWN_NAMES: Record<string, string> = {
  coreweave: "CoreWeave",
  openai: "OpenAI",
  runpod: "RunPod",
  lambda: "Lambda",
  hyperstack: "Hyperstack",
  nebius: "Nebius",
  vast: "Vast.ai",
  crusoe: "Crusoe",
  latitude: "Latitude",
  oblivus: "Oblivus",
  sesterce: "Sesterce",
  thundercompute: "ThunderCompute",
  paperspace: "Paperspace",
  fluidstack: "FluidStack",
  tensordock: "TensorDock",
  datacrunch: "DataCrunch",
  vultr: "Vultr",
  ovhcloud: "OVHcloud",
  scaleway: "Scaleway",
  massedcompute: "Massed Compute",
  jarvis: "Jarvis Labs",
  aws: "AWS",
  gcp: "Google Cloud",
  azure: "Microsoft Azure",
};

function formatProvider(slug: string): string {
  return KNOWN_NAMES[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1);
}

const SHARED_OG_IMAGE = "/assets/data-table-infinite.png";

type Props = {
  params: Promise<{ provider: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { provider } = await params;
  const name = formatProvider(provider);
  const title = `${name} GPU Pricing | Deploybase`;
  const description = `Compare ${name} hourly GPU prices, VRAM, and availability across instance types.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [SHARED_OG_IMAGE],
      url: `/gpus/${provider}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [SHARED_OG_IMAGE],
    },
  };
}

/**
 * SEO landing page for a specific GPU provider.
 *
 * Merges the route-segment provider into searchParams before parsing with nuqs
 * so the server prefetch is correctly filtered. The ProviderGpuClient wrapper
 * seeds ?provider=X into the URL on the client via useLayoutEffect so nuqs
 * and React Query pick up the filter immediately after hydration.
 */
export default async function GpuProviderPage({ params, searchParams }: Props) {
  const { provider } = await params;
  const sp = await searchParams;

  // Merge route param into searchParams so nuqs cache sees the provider filter
  const mergedParams = { ...sp, provider: provider };
  const parsedSearch = searchParamsCache.parse(mergedParams);

  const queryClient = new QueryClient();
  const captured: { firstPage: Awaited<ReturnType<typeof getGpuPricingPage>> | null } = { firstPage: null };

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
        if (!captured.firstPage && (cursor === null || cursor === 0)) {
          captured.firstPage = result;
        }
        return result;
      },
    });
  } catch (error) {
    logger.error("[GpuProviderPage] Failed to prefetch GPU data", {
      provider,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const dehydratedState = dehydrate(queryClient);
  const schemaMarkup = buildGpuSchema(captured.firstPage);

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
        <ProviderGpuClient provider={provider} />
      </div>
    </HydrationBoundary>
  );
}
