"use client";

import type {
  DataTableFilterField,
  Option,
  SheetField,
} from "@/components/data-table/types";
import { format } from "date-fns";
import type { ColumnSchema } from "./schema";

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
    label: "Model",
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
    label: "Config",
    value: "type",
    type: "checkbox",
    defaultOpen: true,
    component: CapitalizedOption,
    skeletonRows: 2,
  },
  {
    label: "Provider",
    value: "provider",
    type: "checkbox",
    defaultOpen: true,
    component: CapitalizedOption,
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
      return (
        <div>
          <h2 className="text-lg font-semibold">{remaining}</h2>
          <p className="pb-4 text-sm text-foreground/70">{firstWord}</p>
        </div>
      );
    },
    skeletonClassName: "w-40",
  },
  {
    id: "provider",
    label: "Provider",
    type: "readonly",
    component: (row) => {
      const providerLabel = row.provider ? row.provider.charAt(0).toUpperCase() + row.provider.slice(1) : "Unknown";
      const regionLabel = row.region ? ` (${row.region}${row.zone ? ` - ${row.zone}` : ""})` : "";
      return <span className="text-sm text-foreground">{providerLabel}{regionLabel}</span>;
    },
    skeletonClassName: "w-40",
  },
  {
    id: "price_hour_usd",
    label: "Price",
    type: "readonly",
    component: (row) =>
      row.price_hour_usd ? `$${row.price_hour_usd.toFixed(2)} /hr` : (
        <span className="text-muted-foreground">N/A</span>
      ),
    skeletonClassName: "w-24",
  },
  {
    id: "gpu_count",
    label: "GPU Count",
    type: "readonly",
    component: (row) => (row.gpu_count ? `${row.gpu_count}x` : "N/A"),
    skeletonClassName: "w-16",
  },
  {
    id: "vram_gb",
    label: "VRAM",
    type: "readonly",
    component: (row) => (row.vram_gb ? `${row.vram_gb}GB` : "N/A"),
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
    label: "System RAM",
    type: "readonly",
    component: (row) => (row.system_ram_gb ? `${row.system_ram_gb}GB` : "N/A"),
    skeletonClassName: "w-20",
  },
  {
    id: "type",
    label: "Type",
    type: "readonly",
    component: (row) => row.type ?? "N/A",
    skeletonClassName: "w-20",
  },
] satisfies SheetField<ColumnSchema>[];
