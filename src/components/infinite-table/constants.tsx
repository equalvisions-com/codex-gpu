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
    label: "Provider",
    value: "provider",
    type: "checkbox",
    defaultOpen: true,
    component: CapitalizedOption,
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
    label: "Model",
    value: "gpu_model",
    type: "checkbox",
    defaultOpen: true,
    component: TruncatedOption,
  },
];

export const sheetFields = [
  {
    id: "provider",
    label: "Provider",
    type: "readonly",
    component: (props) => (
      <div className="text-lg capitalize">{props.provider}</div>
    ),
    skeletonClassName: "w-24",
  },
  {
    id: "gpu_model",
    label: "GPU Model",
    type: "readonly",
    component: (props) => props.gpu_model ? (
      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-sm text-blue-800">
        {props.gpu_model}
      </span>
    ) : <span className="text-muted-foreground">N/A</span>,
    skeletonClassName: "w-20",
  },
  {
    id: "gpu_count",
    label: "GPU Count",
    type: "readonly",
    component: (props) => props.gpu_count ? (
      <div className="flex items-center gap-1">
        <span className="font-mono text-lg">{props.gpu_count}x</span>
        <span className="text-muted-foreground">GPUs</span>
      </div>
    ) : <span className="text-muted-foreground">N/A</span>,
    skeletonClassName: "w-16",
  },
  {
    id: "vram_gb",
    label: "VRAM",
    type: "readonly",
    component: (props) => (
      <span className="font-mono">
        {props.vram_gb ? `${props.vram_gb}GB` : 'N/A'}
      </span>
    ),
    skeletonClassName: "w-16",
  },
  {
    id: "vcpus",
    label: "vCPUs",
    type: "readonly",
    component: (props) => (
      <span className="font-mono">
        {props.vcpus || 'N/A'}
      </span>
    ),
    skeletonClassName: "w-16",
  },
  {
    id: "system_ram_gb",
    label: "System RAM",
    type: "readonly",
    component: (props) => (
      <span className="font-mono">
        {props.system_ram_gb ? `${props.system_ram_gb}GB` : 'N/A'}
      </span>
    ),
    skeletonClassName: "w-20",
  },
  {
    id: "price_hour_usd",
    label: "Price",
    type: "readonly",
    component: (props) => props.price_hour_usd ? (
      <div className="flex items-center gap-1">
        <span className="font-mono text-lg">${props.price_hour_usd.toFixed(3)}</span>
        <span className="text-muted-foreground">per hour</span>
      </div>
    ) : <span className="text-muted-foreground">N/A</span>,
    skeletonClassName: "w-24",
  },
  {
    id: "source_url",
    label: "Source",
    type: "readonly",
    component: (props) => (
      <a
        href={props.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 underline text-sm"
      >
        View on CoreWeave
      </a>
    ),
    skeletonClassName: "w-32",
  },
  {
    id: "observed_at",
    label: "Last Updated",
    type: "readonly",
    component: (props) => format(new Date(props.observed_at), "LLL dd, y HH:mm:ss"),
    skeletonClassName: "w-36",
  },
] satisfies SheetField<ColumnSchema>[];
