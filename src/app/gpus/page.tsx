import type { Metadata } from "next";
import * as React from "react";
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import { Client } from "@/components/infinite-table/client";
import { dataOptions } from "@/components/infinite-table/query-options";
import { searchParamsCache } from "@/components/infinite-table/search-params";
import { getGpuPricingPage } from "@/lib/gpu-pricing-loader";

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

interface GpusPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function normalizeSearchParams(
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

export default function GpusPage({ searchParams }: GpusPageProps) {
  return <GpusHydratedContent searchParams={searchParams} />;
}

async function GpusHydratedContent({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = normalizeSearchParams(
    (await searchParams) ?? {},
  );
  const parsedSearch = searchParamsCache.parse(resolvedSearchParams);

  const queryClient = new QueryClient();
  let firstPagePayload: Awaited<ReturnType<typeof getGpuPricingPage>> | null =
    null;

  if (parsedSearch.favorites !== "true") {
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
        <Client />
      </div>
    </HydrationBoundary>
  );
}

function buildGpuSchema(
  payload: Awaited<ReturnType<typeof getGpuPricingPage>> | null,
) {
  if (!payload || !payload.data?.length) {
    return null;
  }

  const items = payload.data.slice(0, 50).map((row) => {
    const hasPrice =
      typeof row.price_hour_usd === "number" && !Number.isNaN(row.price_hour_usd);
    const additionalProperty = [
      {
        "@type": "PropertyValue",
        name: "VRAM (GB)",
        value: row.vram_gb,
      },
      {
        "@type": "PropertyValue",
        name: "vCPUs",
        value: row.vcpus,
      },
      {
        "@type": "PropertyValue",
        name: "System RAM (GB)",
        value: row.system_ram_gb,
      },
      {
        "@type": "PropertyValue",
        name: "Instance Type",
        value: row.type,
      },
    ].filter((prop) => prop.value !== undefined && prop.value !== null);

    const productItem: Record<string, unknown> = {
      "@type": "Product",
      name: `${row.provider} ${row.gpu_count ?? 1}× ${row.gpu_model ?? "GPU"}`,
      brand: {
        "@type": "Organization",
        name: row.provider,
      },
      category: "GPU Cloud Instance",
      url: row.source_url,
      image: SHARED_OG_IMAGE,
      additionalProperty,
    };

    if (hasPrice) {
      productItem.offers = {
        "@type": "Offer",
        priceCurrency: "USD",
        price: row.price_hour_usd,
        availabilityStarts: row.observed_at,
        areaServed: row.region,
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: row.price_hour_usd,
          priceCurrency: "USD",
          unitCode: "HUR",
        },
      };
    } else {
      productItem.additionalProperty = [
        ...additionalProperty,
        {
          "@type": "PropertyValue",
          name: "price_status",
          value: "missing",
        },
      ];
    }

    return {
      "@type": "DataFeedItem",
      dateCreated: row.observed_at,
      item: productItem,
    };
  });

  return {
    "@context": "https://schema.org",
    "@type": "DataFeed",
    name: "GPU Pricing Feed",
    dateModified: new Date().toISOString(),
    dataFeedElement: items,
  };
}
