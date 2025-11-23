"use client";

import type { DataTableFilterField, SheetField } from "@/components/data-table/types";
import type { ModelsColumnSchema } from "./models-schema";
import Image from "next/image";
import * as React from "react";
import { MODEL_PROVIDER_LOGOS } from "./models-columns";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const formatThroughputDisplay = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "N/A";
  if (!Number.isFinite(value)) return "N/A";
  const formatted = value.toFixed(1);
  return `${formatted} TPS`;
};

const MODEL_AUTHOR_LOGOS: Record<string, { src: string; alt: string }> = Object.keys(
  MODEL_PROVIDER_LOGOS,
).reduce((acc, key) => {
  acc[key.toLowerCase()] = MODEL_PROVIDER_LOGOS[key];
  return acc;
}, {} as Record<string, { src: string; alt: string }>);

const getModelAuthorLogo = (author?: string | null) => {
  if (!author) return null;
  return MODEL_AUTHOR_LOGOS[author.toLowerCase()] ?? null;
};

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
  const initial = alt?.charAt(0).toUpperCase() ?? "";

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
      ) : initial ? (
        <span className="text-[10px] font-semibold uppercase text-foreground/70" aria-hidden="true">
          {initial}
        </span>
      ) : null}
    </span>
  );
};

const ModelProviderBadge = ({ provider }: { provider?: string | null }) => {
  const providerName = provider ?? "";
  const logo = MODEL_PROVIDER_LOGOS[providerName] ?? getModelAuthorLogo(providerName);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <LogoBadge
        src={logo?.src ?? null}
        alt={logo?.alt ?? providerName}
        size={20}
        className="h-5 w-5 shrink-0"
      />
      <span className="truncate" title={providerName || undefined}>
        {providerName || "Unknown"}
      </span>
    </div>
  );
};

const formatPricePerMillion = (price: number | string | null | undefined) => {
  if (price === null || price === undefined) return "Free";
  const numeric = typeof price === "string" ? Number(price) : price;
  if (Number.isNaN(numeric) || numeric === 0) return "Free";
  const perMillion = numeric * 1_000_000;
  return `$${perMillion.toFixed(2)} /M`;
};

const formatContextLength = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "N/A";
  return value.toLocaleString();
};

const formatModalities = (modalities?: string[]) => {
  if (!Array.isArray(modalities) || modalities.length === 0) return "N/A";
  const validModalities = modalities.filter(
    (modality): modality is string => typeof modality === "string" && modality.trim().length > 0,
  );
  if (validModalities.length === 0) return "N/A";
  return validModalities
    .map((modality) => modality.replace(/\b\w/g, (char) => char.toUpperCase()))
    .join(", ");
};

const formatParameterList = (parameters?: string | string[] | null) => {
  if (!parameters) return "N/A";
  const normalized =
    typeof parameters === "string"
      ? parameters
      : Array.isArray(parameters)
        ? parameters.join(",")
        : "";
  const trimmed = normalized.trim();
  if (!trimmed) return "N/A";
  const withoutBraces =
    trimmed.startsWith("{") && trimmed.endsWith("}")
      ? trimmed.slice(1, -1)
      : trimmed;
  const parts = withoutBraces
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return "N/A";
  return parts.join(", ");
};

// Models filter fields
export const filterFields: DataTableFilterField<ModelsColumnSchema>[] = [
  {
    label: "Search",
    value: "search",
    type: "input",
    defaultOpen: true,
  },
  {
    label: "Authors",
    value: "author",
    type: "checkbox",
    defaultOpen: true,
  },
  {
    label: "Prompt",
    value: "inputPrice",
    type: "slider",
    min: 0,
    max: 0.00001,
    defaultOpen: true,
  },
  {
    label: "Context",
    value: "contextLength",
    type: "slider",
    min: 0,
    max: 1000000,
    step: 1024,
    defaultOpen: true,
  },
  {
    label: "Providers",
    value: "provider",
    type: "checkbox",
    defaultOpen: true,
  },
  {
    label: "Modalities",
    value: "modalities",
    type: "checkbox",
    defaultOpen: true,
  },
];

// Sheet fields for detailed view
export const sheetFields: SheetField<ModelsColumnSchema>[] = [
  {
    id: "shortName",
    label: "Model Name",
    type: "readonly",
    hideLabel: true,
    fullRowValue: true,
    noPadding: true,
    component: ({ metadata, ...row }) => {
      const titleClassName =
        typeof metadata === "object" &&
        metadata &&
        typeof (metadata as { titleClassName?: unknown }).titleClassName === "string"
          ? (metadata as { titleClassName: string }).titleClassName
          : undefined;
      const fallback = row.name ?? "N/A";
      const value = row.shortName ?? fallback;
      const authorLogo = getModelAuthorLogo(row.author);
      return (
        <div className="flex items-start gap-3">
          {authorLogo ? (
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-background">
              <Image
                src={authorLogo.src}
                alt={authorLogo.alt}
                fill
                sizes="40px"
                className="object-contain"
                loading="lazy"
              />
            </span>
          ) : (
            <div className="h-10 w-10 shrink-0" />
          )}
          <div className="flex flex-col gap-0 leading-tight">
            <h2 className={cn("text-lg font-semibold leading-tight tracking-tight", titleClassName)}>
              {value || fallback}
            </h2>
            <p className="pb-4 text-sm text-foreground/70 leading-tight">{row.author ?? "N/A"}</p>
          </div>
        </div>
      );
    },
  },
  {
    id: "provider",
    label: "Provider",
    type: "readonly",
    component: (row) => <ModelProviderBadge provider={row.provider} />,
  },
  {
    id: "inputPrice" as keyof ModelsColumnSchema,
    label: "Prompt Price",
    type: "readonly",
    component: (row) => formatPricePerMillion(row.promptPrice),
  },
  {
    id: "outputPrice" as keyof ModelsColumnSchema,
    label: "Output Price",
    type: "readonly",
    component: (row) => formatPricePerMillion(row.completionPrice),
  },
  {
    id: "contextLength",
    label: "Context Length",
    type: "readonly",
    component: (row) => formatContextLength(row.contextLength),
  },
  {
    id: "maxCompletionTokens",
    label: "Max Output",
    type: "readonly",
    component: (row) => formatContextLength(row.maxCompletionTokens),
  },
  {
    id: "inputModalities",
    label: "Input Modalities",
    type: "readonly",
    component: (row) => formatModalities(row.inputModalities),
  },
  {
    id: "outputModalities",
    label: "Output Modalities",
    type: "readonly",
    component: (row) => formatModalities(row.outputModalities),
  },
  {
    id: "supportedParameters",
    label: "Parameters",
    type: "readonly",
    component: (row) => formatParameterList(row.supportedParameters ?? undefined),
  },
];
