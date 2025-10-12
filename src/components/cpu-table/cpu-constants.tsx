"use client";

import type {
  DataTableFilterField,
  Option,
  SheetField,
} from "@/components/data-table/types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { CpuColumnSchema } from "./cpu-schema";

import Image from "next/image";

// CPU pricing filter fields
export const cpuFilterFields: DataTableFilterField<CpuColumnSchema>[] = [
  {
    label: "Provider",
    value: "provider",
    type: "checkbox",
  },
  {
    label: "CPU Model",
    value: "item",
    type: "input",
  },
  {
    label: "vCPUs",
    value: "vcpus",
    type: "slider",
    min: 1,
    max: 256,
  },
  {
    label: "System RAM (GB)",
    value: "system_ram_gb",
    type: "slider",
    min: 8,
    max: 4096,
  },
  {
    label: "Hourly Rate ($)",
    value: "price_hour_usd",
    type: "slider",
    min: 0.1,
    max: 50,
  },
];

export const cpuSheetFields = [
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
    id: "cpu_model",
    label: "CPU Model",
    type: "readonly",
    component: (props) => props.cpu_model || props.item ? (
      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-sm text-blue-800">
        {props.cpu_model || props.item}
      </span>
    ) : <span className="text-muted-foreground">N/A</span>,
    skeletonClassName: "w-20",
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
    label: "Hourly Rate",
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
        View on {props.provider === 'coreweave' ? 'CoreWeave' : props.provider}
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
] satisfies SheetField<CpuColumnSchema>[];
