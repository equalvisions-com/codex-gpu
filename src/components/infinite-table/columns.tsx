"use client";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTableHeaderCheckbox } from "@/components/data-table/data-table-header-checkbox";
import { DataTableColumnLatency } from "@/components/data-table/data-table-column/data-table-column-latency";
import { DataTableColumnCompanyLogo } from "@/components/data-table/data-table-column/data-table-column-company-logo";
import { DataTableColumnRegion } from "@/components/data-table/data-table-column/data-table-column-region";
import { DataTableColumnStatusCode } from "@/components/data-table/data-table-column/data-table-column-status-code";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  getTimingColor,
  getTimingLabel,
  getTimingPercentage,
  timingPhases,
} from "@/lib/request/timing";
import { cn } from "@/lib/utils";
import { HoverCardPortal } from "@radix-ui/react-hover-card";
import { Checkbox } from "@/components/ui/checkbox";
import { useDataTable } from "@/components/data-table/data-table-provider";
import type { ColumnDef } from "@tanstack/react-table";
import Image from "next/image";
import { HoverCardTimestamp } from "./_components/hover-card-timestamp";
import type { ColumnSchema } from "./schema";

const PROVIDER_LOGOS: Record<
  string,
  {
    src: string;
    alt: string;
  }
> = {
  coreweave: { src: "/logos/coreweave.png", alt: "CoreWeave" },
  nebius: { src: "/logos/nebius.png", alt: "Nebius" },
  hyperstack: { src: "/logos/hyperstack.png", alt: "Hyperstack" },
  runpod: { src: "/logos/runpod.png", alt: "RunPod" },
  lambda: { src: "/logos/lambda.png", alt: "Lambda" },
  digitalocean: { src: "/logos/digitalocean.png", alt: "DigitalOcean" },
  oracle: { src: "/logos/oracle.png", alt: "Oracle" },
  crusoe: { src: "/logos/crusoe.png", alt: "Crusoe" },
};

function RowCheckboxCell({ rowId }: { rowId: string }) {
  const { checkedRows, toggleCheckedRow } = useDataTable<ColumnSchema, unknown>();
  const isChecked = checkedRows[rowId] ?? false;
  return (
    <Checkbox
      checked={isChecked}
      onCheckedChange={(next) => toggleCheckedRow(rowId, Boolean(next))}
      aria-label={`Check row ${rowId}`}
    />
  );
}


export const columns: ColumnDef<ColumnSchema>[] = [
  {
    accessorKey: "provider",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Provider" />
    ),
    cell: ({ row }) => {
      const providerRaw = row.getValue<ColumnSchema["provider"]>("provider") ?? "";
      const provider = typeof providerRaw === "string" ? providerRaw : "";
      const normalizedProvider = provider.toLowerCase();
      const logo = PROVIDER_LOGOS[normalizedProvider];
      const fallbackInitial = provider ? provider.charAt(0).toUpperCase() : "";

      return (
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/40 bg-background">
            {logo ? (
              <Image
                src={logo.src}
                alt={logo.alt}
                fill
                sizes="20px"
                className="object-contain"
                loading="eager"
              />
            ) : fallbackInitial ? (
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                {fallbackInitial}
              </span>
            ) : null}
          </span>
          <span className="truncate capitalize" title={provider || undefined}>
            {provider || "Unknown"}
          </span>
        </div>
      );
    },
    size: 155,
    minSize: 155,
    meta: {
      cellClassName: "text-left min-w-[155px]",
      headerClassName: "text-left min-w-[155px]",
    },
  },
  {
    accessorKey: "gpu_model",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Model" />
    ),
    cell: ({ row }) => {
      // Handle both CoreWeave (gpu_model) and Nebius (item) data
      const original = row.original;
      const displayName = original.gpu_model || original.item;

      if (!displayName) return <span className="text-muted-foreground">N/A</span>;

      return (
        <span className="block truncate">{displayName}</span>
      );
    },
    size: 240,
    minSize: 240,
    meta: {
      cellClassName: "text-left overflow-hidden min-w-[240px]",
      headerClassName: "text-left overflow-hidden min-w-[240px]",
    },
  },
  {
    id: "blank",
    header: () => (
      <div className="flex items-center justify-center">
        <DataTableHeaderCheckbox />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    cell: ({ row }) => {
      const stop = (e: any) => e.stopPropagation();
      return (
        <div className="flex items-center justify-center h-full" onClick={stop} onMouseDown={stop} onPointerDown={stop} onKeyDown={stop}>
          <RowCheckboxCell rowId={row.id} />
        </div>
      );
    },
    size: 45,
    minSize: 45,
    maxSize: 45,
    meta: {
      cellClassName: "text-center p-0 min-w-[45px]",
      headerClassName: "min-w-[45px] px-0",
    },
  },
  {
    accessorKey: "price_hour_usd",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Price" titleClassName="ml-auto text-right" />
    ),
    cell: ({ row }) => {
      const original = row.original;
      const price = original.price_hour_usd || original.price_usd;
      const unit = original.price_unit || "hour";

      if (!price) return <span className="text-muted-foreground">N/A</span>;

      return (
        <div className="text-right">
          <span className="font-mono">${price.toFixed(2)}</span>{" "}
          <span className="font-mono text-muted-foreground">/hr</span>
        </div>
      );
    },
    filterFn: "inNumberRange",
    size: 155,
    minSize: 155,
    meta: {
      headerClassName: "text-right min-w-[155px]",
      cellClassName: "text-right min-w-[155px]",
    },
  },
  {
    accessorKey: "gpu_count",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="GPUs" titleClassName="ml-auto text-right" />
    ),
    cell: ({ row }) => {
      const gpuCount = row.getValue<ColumnSchema["gpu_count"]>("gpu_count");
      if (!gpuCount) return <span className="text-muted-foreground">N/A</span>;

      return (
        <div className="text-right">
          <span className="font-mono">{gpuCount}</span>{" "}
          <span className="text-muted-foreground">{gpuCount === 1 ? 'GPU' : 'GPUs'}</span>
        </div>
      );
    },
    filterFn: "inNumberRange",
    size: 155,
    minSize: 155,
    meta: {
      cellClassName: "text-right min-w-[155px]",
      headerClassName: "text-right min-w-[155px]",
    },
  },
  {
    accessorKey: "vram_gb",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="VRAM" titleClassName="ml-auto text-right" />
    ),
    cell: ({ row }) => {
      const vramGb = row.getValue<ColumnSchema["vram_gb"]>("vram_gb");
      return vramGb ? (
        <div className="text-right">
          <span className="font-mono">{vramGb}</span>{" "}
          <span className="text-muted-foreground">GB</span>
        </div>
      ) : <span className="text-muted-foreground">N/A</span>;
    },
    filterFn: "inNumberRange",
    size: 155,
    minSize: 155,
    meta: {
      cellClassName: "text-right min-w-[155px]",
      headerClassName: "text-right min-w-[155px]",
    },
  },
  {
    accessorKey: "vcpus",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="vCPUs" titleClassName="ml-auto text-right" />
    ),
    cell: ({ row }) => {
      const vcpus = row.getValue<ColumnSchema["vcpus"]>("vcpus");
      if (!vcpus) return <span className="text-muted-foreground">N/A</span>;

      return (
        <div className="text-right">
          <span className="font-mono">{vcpus}</span>{" "}
          <span className="text-muted-foreground">vCPUs</span>
        </div>
      );
    },
    filterFn: "inNumberRange",
    size: 155,
    minSize: 155,
    meta: {
      cellClassName: "text-right min-w-[155px]",
      headerClassName: "text-right min-w-[155px]",
    },
  },
  {
    accessorKey: "system_ram_gb",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="RAM" titleClassName="ml-auto text-right" />
    ),
    cell: ({ row }) => {
      const original = row.original;
      const ramGb = original.system_ram_gb || original.ram_gb;
      return ramGb ? (
        <div className="text-right">
          <span className="font-mono">{ramGb}</span>{" "}
          <span className="text-muted-foreground">GB</span>
        </div>
      ) : <span className="text-muted-foreground">N/A</span>;
    },
    filterFn: "inNumberRange",
    size: 155,
    minSize: 155,
    meta: {
      cellClassName: "text-right min-w-[155px]",
      headerClassName: "text-right min-w-[155px]",
    },
  },
  {
    accessorKey: "type",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Config" titleClassName="ml-auto text-right" />
    ),
    cell: ({ row }) => {
      const type = row.getValue<ColumnSchema["type"]>("type");
      return type ? <span className="block text-right">{type}</span> : <span className="text-muted-foreground">N/A</span>;
    },
    size: 155,
    minSize: 155,
    meta: {
      cellClassName: "text-right min-w-[155px]",
      headerClassName: "text-right min-w-[155px]",
    },
  },
];
