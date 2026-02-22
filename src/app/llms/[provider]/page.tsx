import type { Metadata } from "next";
import * as React from "react";
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import { modelsDataOptions } from "@/features/data-explorer/models/models-query-options";
import { ProviderLlmClient } from "./provider-llm-client";
import { modelsSearchParamsCache } from "@/features/data-explorer/models/models-search-params";
import { getModelsPage } from "@/lib/models-loader";
import { buildModelsSchema } from "@/features/data-explorer/models/build-models-schema";
import { logger } from "@/lib/logger";

export const revalidate = 43200;

const SHARED_OG_IMAGE = "/assets/data-table-infinite.png";

type Props = {
  params: Promise<{ provider: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { provider } = await params;
  // provider comes URL-decoded from Next.js (e.g. "OpenAI", "Google AI Studio")
  const name = decodeURIComponent(provider);
  const title = `${name} LLM Pricing | Deploybase`;
  const description = `Compare ${name} language model pricing, context lengths, and modality support.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [SHARED_OG_IMAGE],
      url: `/llms/${encodeURIComponent(provider)}`,
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
 * SEO landing page for a specific LLM provider.
 *
 * Merges the route-segment provider into searchParams before parsing with nuqs
 * so the server prefetch is correctly filtered. The ProviderLlmClient wrapper
 * seeds ?provider=X into the URL on the client via useLayoutEffect so nuqs
 * and React Query pick up the filter immediately after hydration.
 */
export default async function LlmProviderPage({ params, searchParams }: Props) {
  const { provider } = await params;
  const sp = await searchParams;

  // The URL segment is the exact DB provider name (e.g. "OpenAI", "Anthropic")
  // Next.js auto-decodes the URL param, so this matches the DB exactly
  const decodedProvider = decodeURIComponent(provider);

  // Merge route param into searchParams so nuqs cache sees the provider filter
  const mergedParams = { ...sp, provider: decodedProvider };
  const parsedSearch = modelsSearchParamsCache.parse(mergedParams);

  const queryClient = new QueryClient();
  const captured: { firstPage: Awaited<ReturnType<typeof getModelsPage>> | null } = { firstPage: null };

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
        if (!captured.firstPage && (cursor === null || cursor === 0)) {
          captured.firstPage = result;
        }
        return result;
      },
    });
  } catch (error) {
    logger.error("[LlmProviderPage] Failed to prefetch models data", {
      provider: decodedProvider,
      error: error instanceof Error ? error.message : String(error),
    });
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
        <ProviderLlmClient provider={decodedProvider} />
      </div>
    </HydrationBoundary>
  );
}
