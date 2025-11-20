"use client";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTableHeaderCheckbox } from "@/components/data-table/data-table-header-checkbox";
import { Checkbox } from "@/components/ui/checkbox";
import { useDataTable } from "@/components/data-table/data-table-provider";
import type { ColumnDef } from "@tanstack/react-table";
import Image from "next/image";
import type { ColumnSchema } from "./schema";

export const PROVIDER_LOGOS: Record<
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
      className="shadow-sm transition-shadow"
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
                alt=""
                aria-hidden="true"
                role="presentation"
                fill
                sizes="20px"
                className="object-contain"
                loading="eager"
              />
            ) : fallbackInitial ? (
              <span className="text-[10px] font-semibold uppercase text-foreground/70" aria-hidden="true">
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
    size: 156,
    minSize: 156,
    meta: {
      cellClassName: "text-left min-w-[156px]",
      headerClassName: "text-left min-w-[156px]",
    },
  },
  {
    accessorKey: "gpu_model",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Model" />
    ),
    cell: ({ row }) => {
      const displayName = row.original.gpu_model;

      if (!displayName) return <span className="text-foreground/70">N/A</span>;

      return (
        <span className="block truncate">{displayName}</span>
      );
    },
    size: 275,
    minSize: 275,
    meta: {
      cellClassName: "text-left overflow-hidden min-w-[275px]",
      headerClassName: "text-left overflow-hidden min-w-[275px]",
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
      <DataTableColumnHeader column={column} title="Price" />
    ),
    cell: ({ row }) => {
      const original = row.original;
      const price = original.price_hour_usd || original.price_usd;
      if (!price) return <span className="text-foreground/70">N/A</span>;

      return (
        <div className="text-left">
          <span className="font-mono">${price.toFixed(2)}</span>{" "}
          <span className="font-mono text-foreground/70">HR</span>
        </div>
      );
    },
    filterFn: "inNumberRange",
    size: 150,
    minSize: 150,
    meta: {
      headerClassName: "text-left min-w-[150px]",
      cellClassName: "text-left min-w-[150px]",
    },
  },
  {
    accessorKey: "gpu_count",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="GPUs" />
    ),
    cell: ({ row }) => {
      const gpuCount = row.getValue<ColumnSchema["gpu_count"]>("gpu_count");
      if (!gpuCount) return <span className="text-foreground/70">N/A</span>;

      return (
        <div className="text-left">
          <span className="font-mono">{gpuCount}</span>{" "}
          <span className="text-foreground/70">{gpuCount === 1 ? "GPU" : "GPUs"}</span>
        </div>
      );
    },
    filterFn: "inNumberRange",
    size: 150,
    minSize: 150,
    meta: {
      cellClassName: "text-left min-w-[150px]",
      headerClassName: "text-left min-w-[150px]",
    },
  },
  {
    accessorKey: "vram_gb",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="VRAM" />
    ),
    cell: ({ row }) => {
      const vramGb = row.getValue<ColumnSchema["vram_gb"]>("vram_gb");
      return vramGb ? (
        <div className="text-left">
          <span className="font-mono">{vramGb}</span>{" "}
          <span className="text-foreground/70">GB</span>
        </div>
      ) : (
        <span className="text-foreground/70">N/A</span>
      );
    },
    filterFn: "inNumberRange",
    size: 150,
    minSize: 150,
    meta: {
      cellClassName: "text-left min-w-[150px]",
      headerClassName: "text-left min-w-[150px]",
    },
  },
  {
    accessorKey: "vcpus",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="vCPUs" />
    ),
    cell: ({ row }) => {
      const vcpus = row.getValue<ColumnSchema["vcpus"]>("vcpus");
      if (!vcpus) return <span className="text-foreground/70">N/A</span>;

      return (
        <div className="text-left">
          <span className="font-mono">{vcpus}</span>{" "}
          <span className="text-foreground/70">vCPUs</span>
        </div>
      );
    },
    filterFn: "inNumberRange",
    size: 150,
    minSize: 150,
    meta: {
      cellClassName: "text-left min-w-[150px]",
      headerClassName: "text-left min-w-[150px]",
    },
  },
  {
    accessorKey: "system_ram_gb",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="RAM" />
    ),
    cell: ({ row }) => {
      const ramGb = row.getValue<ColumnSchema["system_ram_gb"]>("system_ram_gb");
      return ramGb ? (
        <div className="text-left">
          <span className="font-mono">{ramGb}</span>{" "}
          <span className="text-foreground/70">GB</span>
        </div>
      ) : (
        <span className="text-foreground/70">N/A</span>
      );
    },
    filterFn: "inNumberRange",
    size: 150,
    minSize: 150,
    meta: {
      cellClassName: "text-left min-w-[150px]",
      headerClassName: "text-left min-w-[150px]",
    },
  },
  {
    accessorKey: "type",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Config" />
    ),
    cell: ({ row }) => {
      const type = row.getValue<ColumnSchema["type"]>("type");
      return type ? <span className="block text-left text-[12px] border border-border/70 w-fit bg-background leading-[18px] rounded-sm h-[20px] px-[6px]">{type}</span> : <span className="text-foreground/70">N/A</span>;
    },
    size: 150,
    minSize: 150,
    meta: {
      cellClassName: "text-left min-w-[150px]",
      headerClassName: "text-left min-w-[150px]",
    },
  },
];
