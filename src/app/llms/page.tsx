import type { Metadata } from "next";
import * as React from "react";
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import { ModelsClient } from "@/components/models-table/models-client";
import { modelsDataOptions } from "@/components/models-table/models-query-options";
import { modelsSearchParamsCache } from "@/components/models-table/models-search-params";
import { getModelsPage } from "@/lib/models-loader";

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

interface ModelsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function normalizeModelsSearchParams(
  input: Record<string, string | string[] | undefined>,
) {
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") {
      normalized[key] = value;
      continue;
    }

    if (Array.isArray(value) && value.length > 0) {
      normalized[key] = value[0] ?? "";
    }
  }

  return normalized;
}

export default function ModelsPage({ searchParams }: ModelsPageProps) {
  return <ModelsHydratedContent searchParams={searchParams} />;
}

async function ModelsHydratedContent({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = normalizeModelsSearchParams(
    (await searchParams) ?? {},
  );
  const parsedSearch = modelsSearchParamsCache.parse(resolvedSearchParams);

  const queryClient = new QueryClient();
  let firstPagePayload: Awaited<ReturnType<typeof getModelsPage>> | null =
    null;

  if (parsedSearch.favorites !== "true") {
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
      console.error("[ModelsPage] Failed to prefetch models data", {
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
            __html: JSON.stringify(schemaMarkup),
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

function buildModelsSchema(
  payload: Awaited<ReturnType<typeof getModelsPage>> | null,
) {
  if (!payload || !payload.data?.length) {
    return null;
  }

  const items = payload.data.slice(0, 50).map((model) => {
    const offers = [] as Array<Record<string, unknown>>;

    if (typeof model.pricing?.prompt === "number") {
      offers.push({
        "@type": "Offer",
        priceCurrency: "USD",
        price: model.pricing.prompt,
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: model.pricing.prompt,
          priceCurrency: "USD",
          unitText: "per million prompt tokens",
        },
      });
    }

    if (typeof model.pricing?.completion === "number") {
      offers.push({
        "@type": "Offer",
        priceCurrency: "USD",
        price: model.pricing.completion,
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: model.pricing.completion,
          priceCurrency: "USD",
          unitText: "per million completion tokens",
        },
      });
    }

    const additionalProperty = [
      {
        "@type": "PropertyValue",
        name: "Context Length",
        value: model.contextLength,
      },
      {
        "@type": "PropertyValue",
        name: "Modalities",
        value: [...model.inputModalities, ...model.outputModalities].join(", "),
      },
      {
        "@type": "PropertyValue",
        name: "MMLU",
        value: model.mmlu,
      },
    ].filter((prop) => prop.value !== null && prop.value !== undefined);

    return {
      "@type": "DataFeedItem",
      dateModified: model.scrapedAt,
      item: {
        "@type": "SoftwareApplication",
        name: model.name ?? model.shortName ?? model.slug,
        applicationCategory: "AI language model",
        operatingSystem: "Cloud",
        description: model.description,
        provider: model.provider
          ? {
              "@type": "Organization",
              name: model.provider,
            }
          : undefined,
        author: model.author
          ? {
              "@type": "Organization",
              name: model.author,
            }
          : undefined,
        softwareVersion: model.modelVersionGroupId ?? undefined,
        ...(offers.length ? { offers } : {}),
        additionalProperty: additionalProperty.length
          ? additionalProperty
          : undefined,
      },
    };
  });

  return {
    "@context": "https://schema.org",
    "@type": "DataFeed",
    name: "LLM Benchmark Feed",
    dateModified: new Date().toISOString(),
    dataFeedElement: items,
  };
}
