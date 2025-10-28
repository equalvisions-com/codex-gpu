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
      const provider = row.getValue<ColumnSchema["provider"]>("provider");
      return (
        <div className="flex items-center gap-2">
          {provider === "coreweave" && (
            <Image src="/logos/coreweave.png" alt="CoreWeave" width={20} height={20} className="rounded" />
          )}
          {provider === "nebius" && (
            <Image src="/logos/nebius.png" alt="Nebius" width={20} height={20} className="rounded" />
          )}
          {provider === "hyperstack" && (
            <Image src="/logos/hyperstack.png" alt="Hyperstack" width={20} height={20} className="rounded" />
          )}
          {provider === "runpod" && (
            <Image src="/logos/runpod.png" alt="RunPod" width={20} height={20} className="rounded" />
          )}
          {provider === "lambda" && (
            <Image src="/logos/lambda.png" alt="Lambda" width={20} height={20} className="rounded" />
          )}
          {provider === "digitalocean" && (
            <Image src="/logos/digitalocean.png" alt="DigitalOcean" width={20} height={20} className="rounded" />
          )}
          {provider === "oracle" && (
            <Image src="/logos/oracle.png" alt="Oracle" width={20} height={20} className="rounded" />
          )}
          {provider === "crusoe" && (
            <Image src="/logos/crusoe.png" alt="Crusoe" width={20} height={20} className="rounded" />
          )}
          <span className="capitalize">{provider}</span>
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
    size: 261,
    minSize: 261,
    meta: {
      cellClassName: "text-left overflow-hidden min-w-[261px]",
      headerClassName: "text-left overflow-hidden min-w-[261px]",
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
