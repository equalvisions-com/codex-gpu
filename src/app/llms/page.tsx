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

    const inputPricePerMillion = parsePricePerMillion(model.pricing?.prompt);
    const outputPricePerMillion = parsePricePerMillion(
      model.pricing?.completion,
    );

    const additionalProperty: Array<{
      "@type": "PropertyValue";
      name: string;
      value: string | number;
    }> = [];

    if (typeof model.contextLength === "number") {
      additionalProperty.push({
        "@type": "PropertyValue",
        name: "Context Length",
        value: model.contextLength,
      });
    }

    if (model.slug) {
      additionalProperty.push({
        "@type": "PropertyValue",
        name: "Model ID",
        value: model.slug,
      });
    }

    if (model.inputModalities && model.inputModalities.length > 0) {
      additionalProperty.push({
        "@type": "PropertyValue",
        name: "Input Modalities",
        value: model.inputModalities.join(", "),
      });
    }

    if (model.outputModalities && model.outputModalities.length > 0) {
      additionalProperty.push({
        "@type": "PropertyValue",
        name: "Output Modalities",
        value: model.outputModalities.join(", "),
      });
    }

    if (inputPricePerMillion !== null) {
      additionalProperty.push({
        "@type": "PropertyValue",
        name: "Prompt Price (USD / 1M tokens)",
        value: inputPricePerMillion,
      });
    }

    if (outputPricePerMillion !== null) {
      additionalProperty.push({
        "@type": "PropertyValue",
        name: "Output Price (USD / 1M tokens)",
        value: outputPricePerMillion,
      });
    }

    if (typeof model.mmlu === "number") {
      additionalProperty.push({
        "@type": "PropertyValue",
        name: "MMLU-Pro Score",
        value: Number((model.mmlu * 100).toFixed(2)),
      });
    }

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
        additionalProperty: additionalProperty.length
          ? additionalProperty
          : undefined,
        url:
          model.slug && process.env.NEXT_PUBLIC_SITE_URL
            ? `${process.env.NEXT_PUBLIC_SITE_URL}/llms?uuid=${model.id}`
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

function parsePricePerMillion(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? Number((value * 1_000_000).toFixed(6))
      : null;
  }
  if (typeof value === "string") {
    const numeric = Number(value);
    return Number.isFinite(numeric)
      ? Number((numeric * 1_000_000).toFixed(6))
      : null;
  }
  return null;
}
