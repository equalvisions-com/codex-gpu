"use client";

import type {
  DataTableFilterField,
  Option,
  SheetField,
} from "@/components/data-table/types";
import { format } from "date-fns";
import type { ColumnSchema } from "./schema";
import Image from "next/image";
import * as React from "react";
import { PROVIDER_LOGOS } from "./columns";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const LogoBadge = ({
  src,
  alt,
  size,
  className,
}: {
  src?: string | null;
  alt?: string | null;
  size: number;
  className?: string;
}) => {
  const [loaded, setLoaded] = React.useState(false);

  return (
    <span
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-md border border-border/60 bg-background",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {!loaded ? <Skeleton className="absolute inset-0 h-full w-full animate-pulse" /> : null}
      {src ? (
        <Image
          src={src}
          alt=""
          aria-hidden="true"
          role="presentation"
          fill
          sizes={`${size}px`}
          className="object-contain"
          loading="lazy"
          onLoadingComplete={() => setLoaded(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase text-foreground/70" aria-hidden="true">
          {(alt ?? "").charAt(0)}
        </div>
      )}
    </span>
  );
};

const ProviderBadge = ({ provider, region, zone }: { provider?: string; region?: string | null; zone?: string | null }) => {
  const normalizedProvider = provider?.toLowerCase() ?? "";
  const logo = PROVIDER_LOGOS[normalizedProvider];
  const fallbackInitial = provider ? provider.charAt(0).toUpperCase() : "";
  return (
    <div className="flex min-w-0 items-center gap-2">
      <LogoBadge
        src={logo?.src ?? null}
        alt={logo?.alt ?? fallbackInitial}
        size={20}
        className="h-5 w-5 shrink-0"
      />
      <span className="truncate capitalize" title={provider || undefined}>
        {provider || "Unknown"}
      </span>
      {region ? (
        <span className="text-xs text-foreground/70">
          ({region}
          {zone ? ` - ${zone}` : ""})
        </span>
      ) : null}
    </div>
  );
};

const GPU_BRAND_LOGOS: Record<
  string,
  {
    src: string;
    alt: string;
  }
> = {
  nvidia: { src: "/logos/nvidia.png", alt: "NVIDIA" },
  amd: { src: "/logos/amd.png", alt: "AMD" },
  intel: { src: "/logos/intel.png", alt: "Intel" },
  asus: { src: "/logos/asus.png", alt: "ASUS" },
  gigabyte: { src: "/logos/gigabyte.png", alt: "Gigabyte" },
  lenovo: { src: "/logos/lenovo.png", alt: "Lenovo" },
};

const getGpuBrandLogo = (brand?: string) => {
  if (!brand) return null;
  return GPU_BRAND_LOGOS[brand.toLowerCase()] ?? null;
};

const TruncatedOption = ({ label }: Option) => {
  const base = String(label ?? "");
  const maxLength = 23;
  const display = base.length > maxLength ? `${base.slice(0, maxLength)}…` : base;
  return <span className="block w-full truncate font-normal" title={base}>{display}</span>;
};

const CapitalizedOption = ({ label }: Option) => {
  const base = String(label ?? "");
  return <span className="block w-full truncate font-normal capitalize" title={base}>{base}</span>;
};

const VRAM_SLIDER_MIN = 16;
const VRAM_SLIDER_MAX = 192;
const VRAM_SLIDER_STEP = 1;

// GPU pricing filter fields
export const filterFields: DataTableFilterField<ColumnSchema>[] = [
  {
    label: "Search",
    value: "search",
    type: "input",
    defaultOpen: true,
  },
  {
    label: "Models",
    value: "gpu_model",
    type: "checkbox",
    defaultOpen: true,
    component: TruncatedOption,
  },
  {
    label: "Price",
    value: "price_hour_usd",
    type: "slider",
    min: 0.01,
    max: 20,
    step: 0.01,
    defaultOpen: true,
  },
  {
    label: "VRAM",
    value: "vram_gb",
    type: "slider",
    min: VRAM_SLIDER_MIN,
    max: VRAM_SLIDER_MAX,
    step: VRAM_SLIDER_STEP,
    defaultOpen: true,
  },
  {
    label: "Providers",
    value: "provider",
    type: "checkbox",
    defaultOpen: true,
    component: CapitalizedOption,
  },
  {
    label: "Config",
    value: "type",
    type: "checkbox",
    defaultOpen: true,
    component: CapitalizedOption,
    skeletonRows: 2,
  },
];

export const sheetFields = [
  {
    id: "gpu_model",
    label: "GPU Configuration",
    type: "readonly",
    hideLabel: true,
    fullRowValue: true,
    noPadding: true,
    component: (row) => {
      const headlineSource = row.gpu_model || row.item || row.sku || "Unknown configuration";
      const headlineParts = headlineSource.trim().split(/\s+/);
      const firstWord = headlineParts.shift() ?? "";
      const remaining = headlineParts.join(" ") || "Unknown configuration";
      const brandLogo = getGpuBrandLogo(firstWord);
      return (
        <div className="flex items-start gap-3">
          <LogoBadge
            src={brandLogo?.src ?? null}
            alt={brandLogo?.alt ?? firstWord}
            size={40}
            className="h-10 w-10 shrink-0"
          />
          <div className="flex flex-col gap-0 leading-tight">
            <h2 className="text-lg font-semibold leading-tight tracking-tight">{remaining}</h2>
            <p className="pb-4 text-sm text-foreground/70 leading-tight">{firstWord}</p>
          </div>
        </div>
      );
    },
    skeletonClassName: "w-40",
  },
  {
    id: "provider",
    label: "Provider",
    type: "readonly",
    component: (row) => (
      <ProviderBadge provider={row.provider} region={row.region} zone={row.zone} />
    ),
    skeletonClassName: "w-40",
  },
  {
    id: "price_hour_usd",
    label: "Price",
    type: "readonly",
    component: (row) =>
      row.price_hour_usd ? `$${row.price_hour_usd.toFixed(2)} /HR` : (
        <span className="text-muted-foreground">N/A</span>
      ),
    skeletonClassName: "w-24",
  },
  {
    id: "gpu_count",
    label: "GPU Count",
    type: "readonly",
    component: (row) => (row.gpu_count ? `${row.gpu_count}` : "N/A"),
    skeletonClassName: "w-16",
  },
  {
    id: "vram_gb",
    label: "VRAM",
    type: "readonly",
    component: (row) => (row.vram_gb ? `${row.vram_gb} GB` : "N/A"),
    skeletonClassName: "w-16",
  },
  {
    id: "vcpus",
    label: "vCPUs",
    type: "readonly",
    component: (row) =>
      row.vcpus === undefined || row.vcpus === null ? "N/A" : `${row.vcpus}`,
    skeletonClassName: "w-16",
  },
  {
    id: "system_ram_gb",
    label: "RAM",
    type: "readonly",
    component: (row) => (row.system_ram_gb ? `${row.system_ram_gb} GB` : "N/A"),
    skeletonClassName: "w-20",
  },
  {
    id: "type",
    label: "Config",
    type: "readonly",
    component: (row) => row.type ?? "N/A",
    skeletonClassName: "w-20",
  },
] satisfies SheetField<ColumnSchema>[];
