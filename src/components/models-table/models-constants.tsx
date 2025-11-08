"use client";

import type { DataTableFilterField, SheetField } from "@/components/data-table/types";
import type { ModelsColumnSchema } from "./models-schema";

const formatPricePerMillion = (price: number | string | null | undefined) => {
  if (price === null || price === undefined) return "Free";
  const numeric = typeof price === "string" ? Number(price) : price;
  if (Number.isNaN(numeric) || numeric === 0) return "Free";
  const perMillion = numeric * 1_000_000;
  return `$${perMillion.toFixed(2)} /M`;
};

const formatContextLength = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "Unknown";
  return value.toLocaleString();
};

const formatModalities = (modalities?: string[]) => {
  if (!Array.isArray(modalities) || modalities.length === 0) return "Unknown";
  const validModalities = modalities.filter(
    (modality): modality is string => typeof modality === "string" && modality.trim().length > 0,
  );
  if (validModalities.length === 0) return "Unknown";
  return validModalities
    .map((modality) => modality.replace(/\b\w/g, (char) => char.toUpperCase()))
    .join(", ");
};

const formatParameterList = (parameters?: string | string[] | null) => {
  if (!parameters) return "Unknown";
  const normalized =
    typeof parameters === "string"
      ? parameters
      : Array.isArray(parameters)
        ? parameters.join(",")
        : "";
  const trimmed = normalized.trim();
  if (!trimmed) return "Unknown";
  const withoutBraces =
    trimmed.startsWith("{") && trimmed.endsWith("}")
      ? trimmed.slice(1, -1)
      : trimmed;
  const parts = withoutBraces
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return "Unknown";
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
    label: "Labs",
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
    min: 1000,
    max: 1000000,
    step: 1024,
    defaultOpen: true,
  },
  {
    label: "Modalities",
    value: "modalities",
    type: "checkbox",
    defaultOpen: true,
  },
  {
    label: "Provider",
    value: "provider",
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
    component: (row) => {
      const fallback = row.name ?? "Unknown";
      const value = row.shortName ?? fallback;
      return <h2 className="text-xl font-semibold">{value || fallback}</h2>;
    },
  },
  {
    id: "author",
    label: "Author",
    type: "readonly",
    hideLabel: true,
    fullRowValue: true,
    noPadding: true,
    component: (row) => (
      <p className="pb-2 text-sm text-foreground/70">{row.author ?? "Unknown"}</p>
    ),
  },
  {
    id: "provider",
    label: "Provider",
    type: "readonly",
  },
  {
    id: "inputPrice" as keyof ModelsColumnSchema,
    label: "Prompt Price",
    type: "readonly",
    component: (row) => formatPricePerMillion(row.pricing?.prompt),
  },
  {
    id: "outputPrice" as keyof ModelsColumnSchema,
    label: "Output Price",
    type: "readonly",
    component: (row) => formatPricePerMillion(row.pricing?.completion),
  },
  {
    id: "contextLength",
    label: "Context Length",
    type: "readonly",
    component: (row) => formatContextLength(row.contextLength),
  },
  {
    id: "maxCompletionTokens",
    label: "Max Output Tokens",
    type: "readonly",
    component: (row) => formatContextLength(row.maxCompletionTokens),
  },
  {
    id: "mmlu",
    label: "MMLU-Pro",
    type: "readonly",
    component: (row) => {
      const score = row.mmlu;
      if (score === null || score === undefined) return "Not available";
      return `${(score * 100).toFixed(1)}%`;
    },
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
