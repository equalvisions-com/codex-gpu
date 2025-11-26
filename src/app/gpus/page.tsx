import type { Metadata } from "next";
import { HydratedInfinitePage } from "@/components/data-pages/hydrated-infinite-page";
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

// ISR-friendly route: we hydrate React Query with the default (unfiltered)
// dataset only. URL-bound filters are handled on the client via nuqs so SSR
// stays static while the table fetches as needed after hydration.

export default function GpusPage() {
  return (
    <HydratedInfinitePage
      parseSearch={() => searchParamsCache.parse({})}
      getInfiniteOptions={dataOptions}
      fetchPage={getGpuPricingPage}
      shouldPrefetch={(search) => search.bookmarks !== "true"}
      buildSchema={buildGpuSchema}
      renderClient={Client}
      logTag="GpusPage"
    />
  );
}

function buildGpuSchema(
  payload: Awaited<ReturnType<typeof getGpuPricingPage>> | null,
) {
  if (!payload || !payload.data?.length) {
    return null;
  }

  const pricedRows = payload.data.filter(
    (row) =>
      typeof row.price_hour_usd === "number" &&
      !Number.isNaN(row.price_hour_usd),
  );

  if (!pricedRows.length) {
    return null;
  }

  const items = pricedRows.slice(0, 50).map((row) => {
    const providerName = formatProviderName(row.provider);
    const gpuModel = row.gpu_model?.trim() || null;
    const gpuCount =
      typeof row.gpu_count === "number" && row.gpu_count > 0
        ? row.gpu_count
        : null;
    const instanceType = row.type ?? "VM";
    const additionalProperty: Array<{
      "@type": "PropertyValue";
      name: string;
      value: string | number;
    }> = [];

    pushProperty(additionalProperty, "GPU Model", gpuModel);
    pushProperty(additionalProperty, "GPU Count", gpuCount);
    pushProperty(additionalProperty, "VRAM (GB)", row.vram_gb);
    pushProperty(additionalProperty, "vCPUs", row.vcpus);
    pushProperty(additionalProperty, "System RAM (GB)", row.system_ram_gb);
    pushProperty(additionalProperty, "Instance Type", instanceType);

    const normalizedSku = normalizeSku(row.stable_key ?? row.sku ?? null);

    const productItem: Record<string, unknown> = {
      "@type": "Product",
      name: buildGpuProductName(providerName, gpuCount, gpuModel, instanceType),
      brand: {
        "@type": "Organization",
        name: providerName,
      },
      category: "GPU Cloud Instance",
      url:
        row.uuid && process.env.NEXT_PUBLIC_SITE_URL
          ? `${process.env.NEXT_PUBLIC_SITE_URL}/gpus?uuid=${encodeURIComponent(
              row.uuid,
            )}`
          : undefined,
      image: SHARED_OG_IMAGE,
      sku: normalizedSku ?? undefined,
      description: buildGpuDescription({
        providerName,
        gpuModel,
        gpuCount,
        instanceType,
        vram: row.vram_gb,
        vcpus: row.vcpus,
        systemRam: row.system_ram_gb,
      }),
      additionalProperty,
    };

    productItem.offers = {
      "@type": "Offer",
      priceCurrency: "USD",
      price: row.price_hour_usd,
      availabilityStarts: row.observed_at,
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: row.price_hour_usd,
        priceCurrency: "USD",
        unitCode: "HUR",
      },
    };
    pushProperty(additionalProperty, "Stable Key", row.stable_key);

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

function pushProperty(
  list: Array<{ "@type": "PropertyValue"; name: string; value: string | number }>,
  name: string,
  value: unknown,
) {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return;
  }
  list.push({
    "@type": "PropertyValue",
    name,
    value: typeof value === "string" ? value : Number(value),
  });
}

function formatProviderName(provider?: string | null) {
  if (!provider) return "Unknown Provider";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function buildGpuProductName(
  provider: string,
  gpuCount: number | null,
  gpuModel: string | null,
  instanceType: string,
) {
  const countLabel = gpuCount ?? 1;
  const modelLabel = gpuModel ?? "GPU";
  return `${provider} – ${countLabel}× ${modelLabel} (${instanceType})`;
}

function buildGpuDescription({
  providerName,
  gpuModel,
  gpuCount,
  instanceType,
  vram,
  vcpus,
  systemRam,
}: {
  providerName: string;
  gpuModel: string | null;
  gpuCount: number | null;
  instanceType: string;
  vram?: number | null;
  vcpus?: number | string | null;
  systemRam?: number | null;
}) {
  const parts: string[] = [];
  const countLabel = gpuCount ?? 1;
  const modelLabel = gpuModel ?? "GPU";
  parts.push(
    `${countLabel}× ${modelLabel} ${instanceType.toLowerCase()} from ${providerName}`,
  );
  if (typeof vram === "number") {
    parts.push(`${vram} GB VRAM`);
  }
  if (vcpus !== null && vcpus !== undefined && vcpus !== "") {
    parts.push(`${vcpus} vCPUs`);
  }
  if (typeof systemRam === "number") {
    parts.push(`${systemRam} GB system RAM`);
  }
  parts.push("billed hourly.");
  return parts.join(", ");
}

function normalizeSku(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\s+/g, "-");
}
