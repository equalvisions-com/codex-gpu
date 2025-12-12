"use client";

import { DataTableColumnHeader } from "@/features/data-explorer/data-table/data-table-column-header";
import { DataTableHeaderCheckbox } from "@/features/data-explorer/data-table/data-table-header-checkbox";
import { useDataTable } from "@/features/data-explorer/data-table/data-table-provider";
import { Checkbox } from "@/components/ui/checkbox";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { HoverCardPortal } from "@radix-ui/react-hover-card";
import type { ColumnDef, SortingFn } from "@tanstack/react-table";
import Image from "next/image";
import type { ModelsColumnSchema } from "./models-schema";
import { getModelProviderLogo } from "./model-provider-logos";

function RowCheckboxCell({ rowId }: { rowId: string }) {
  const { checkedRows, toggleCheckedRow } = useDataTable<ModelsColumnSchema, unknown>();
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

function formatPricePerMillion(price: string | number | null | undefined): string {
  if (price === undefined || price === null) return 'Free';

  const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numericPrice) || numericPrice === 0) return 'Free';

  // Convert from per-token to per-million-tokens
  const perMillion = numericPrice * 1_000_000;

  // Format with 2 decimal places
  return `$${perMillion.toFixed(2)}`;
}

function formatThroughput(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';
  if (!Number.isFinite(value)) return 'N/A';
  return value.toFixed(1);
}

export const modelsColumns: ColumnDef<ModelsColumnSchema>[] = [
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
        <div
          className="flex h-full items-center justify-center"
          onClick={stop}
          onMouseDown={stop}
          onPointerDown={stop}
          onKeyDown={stop}
        >
          <RowCheckboxCell rowId={row.id} />
        </div>
      );
    },
    size: 45,
    minSize: 45,
    maxSize: 45,
    meta: {
      cellClassName: "min-w-[45px] p-0 text-center",
      headerClassName: "min-w-[45px] px-0",
    },
  },
  {
    accessorKey: "provider",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Provider" className="pl-0 pr-[12px]" />
    ),
    cell: ({ row }) => {
      const providerRaw = row.getValue<ModelsColumnSchema["provider"]>("provider") ?? "";
      const provider = typeof providerRaw === "string" ? providerRaw : "";
      const logo = getModelProviderLogo(provider);
      const fallbackInitial = provider ? provider.charAt(0).toUpperCase() : "";

      return (
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-md bg-background">
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
              <span className="text-[10px] font-semibold uppercase text-muted-foreground" aria-hidden="true">
                {fallbackInitial}
              </span>
            ) : null}
          </span>
          <span className="truncate" title={provider || undefined}>
            {provider || "Unknown"}
          </span>
        </div>
      );
    },
    size: 171,
    minSize: 171,
    meta: {
      cellClassName: "text-left min-w-[171px] pl-0",
      headerClassName: "text-left min-w-[171px] pl-0",
    },
  },
  {
    id: "name",
    accessorFn: (row) => (typeof row.shortName === "string" ? row.shortName : ""),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Model" />
    ),
    cell: ({ row }) => {
      const { shortName, name } = row.original;
      const primaryLabel = typeof shortName === "string" && shortName.trim().length
        ? shortName
        : name;

      if (!primaryLabel) {
        return <span className="text-muted-foreground">Unknown</span>;
      }

      return <div className="truncate">{primaryLabel}</div>;
    },
    size: 275,
    minSize: 275,
    meta: {
      cellClassName: "text-left overflow-hidden min-w-[275px] pr-0",
      headerClassName: "text-left overflow-hidden min-w-[275px]",
    },
  },
  {
    accessorKey: "contextLength",
    header: ({ column }) => (
      <div className="flex justify-end">
        <DataTableColumnHeader column={column} title="Context" />
      </div>
    ),
    cell: ({ row }) => {
      const contextLength = row.original.contextLength;

      if (!contextLength) return <span className="text-muted-foreground">N/A</span>;

      // Format large numbers (e.g., 256000 -> 256K, 1000000 -> 1M)
      const formatContextLength = (length: number): string => {
        if (length >= 1_000_000) {
          return `${(length / 1_000_000).toFixed(1)}M`;
        } else if (length >= 1000) {
          return `${(length / 1000).toFixed(0)}K`;
        }
        return length.toString();
      };

      return (
        <div className="font-mono text-sm text-right">
          {formatContextLength(contextLength)} <span className="text-foreground/70">TOK</span>
        </div>
      );
    },
    filterFn: "inNumberRange",
    size: 150,
    minSize: 150,
    meta: {
      cellClassName: "text-right min-w-[150px]",
      headerClassName: "text-right min-w-[150px]",
    },
  },
  {
    accessorKey: "maxCompletionTokens",
    header: ({ column }) => (
      <div className="flex justify-end">
        <DataTableColumnHeader column={column} title="Max Output" />
      </div>
    ),
    cell: ({ row }) => {
      const maxTokens = row.original.maxCompletionTokens;

      if (!maxTokens) {
        return <span className="text-foreground/70">N/A</span>;
      }

      // Format large numbers (e.g., 96000 -> 96K, 1000000 -> 1M)
      const formatMaxTokens = (tokens: number): string => {
        if (tokens >= 1_000_000) {
          return `${(tokens / 1_000_000).toFixed(1)}M`;
        } else if (tokens >= 1000) {
          return `${(tokens / 1000).toFixed(0)}K`;
        }
        return tokens.toString();
      };

      return (
        <div className="font-mono text-sm text-right">
          {formatMaxTokens(maxTokens)} <span className="text-foreground/70">TOK</span>
        </div>
      );
    },
    filterFn: "inNumberRange",
    enableSorting: true,
    sortingFn: "auto",
    size: 150,
    minSize: 150,
    meta: {
      cellClassName: "text-right min-w-[150px]",
      headerClassName: "text-right min-w-[150px]",
    },
  },
  {
    accessorKey: "throughput",
    header: ({ column }) => (
      <div className="flex justify-end">
        <DataTableColumnHeader column={column} title="Throughput" />
      </div>
    ),
    cell: ({ row }) => {
      const throughput = row.original.throughput;
      const formatted = formatThroughput(throughput ?? null);
      const isNA = formatted === "N/A";
      return (
        <span className={cn("block text-right font-mono text-sm tabular-nums", isNA ? "text-foreground/70" : undefined)}>
          {formatted}
          {!isNA ? <span className="text-foreground/70"> TPS</span> : null}
        </span>
      );
    },
    enableSorting: true,
    sortingFn: "auto",
    size: 150,
    minSize: 150,
    meta: {
      cellClassName: "text-right min-w-[150px] tabular-nums",
      headerClassName: "text-right min-w-[150px] tabular-nums",
    },
  },
  {
    id: "modalities",
    accessorKey: "inputModalities",
    header: ({ column }) => (
      <div className="flex justify-end">
        <DataTableColumnHeader column={column} title="Modality" />
      </div>
    ),
    cell: ({ row }) => {
      const inputModalities = row.original.inputModalities ?? [];
      const outputModalities = row.original.outputModalities ?? [];
      const hasModalities = inputModalities.length + outputModalities.length > 0;

      const computedScore = row.original.modalityScore ?? new Set([
        ...inputModalities,
        ...outputModalities,
      ]).size;

      if (!hasModalities || computedScore === 0) {
        return <span className="text-foreground/70">N/A</span>;
      }

      const label = computedScore > 1 ? "Multimodal" : "Unimodal";
      const formatList = (modalities: string[]) => (
        modalities.length
          ? modalities.map(modality => modality.charAt(0).toUpperCase() + modality.slice(1)).join(", ")
          : "-"
      );

      return (
        <div className="flex justify-end">
          <HoverCard openDelay={0} closeDelay={0}>
            <HoverCardTrigger asChild>
              <div className="text-[12px] border border-border/70 w-fit bg-background leading-[18px] rounded-sm h-[20px] px-[6px] text-left tracking-wide cursor-pointer">
                {label}
              </div>
            </HoverCardTrigger>
            <HoverCardPortal>
              <HoverCardContent side="bottom" sideOffset={8} collisionPadding={12} className="w-fit max-w-[155px] text-left text-xs space-y-1.5 p-2">
                <div>
                  <span className="font-semibold text-foreground">Input:</span>{" "}
                  <span className="text-foreground/80">{formatList(inputModalities)}</span>
                </div>
                <div>
                  <span className="font-semibold text-foreground">Output:</span>{" "}
                  <span className="text-foreground/80">{formatList(outputModalities)}</span>
                </div>
              </HoverCardContent>
            </HoverCardPortal>
          </HoverCard>
        </div>
      );
    },
    enableSorting: true,
    size: 150,
    minSize: 150,
    meta: {
      cellClassName: "text-right min-w-[150px]",
      headerClassName: "text-right min-w-[150px]",
    },
  },
  {
    id: "inputPrice",
    accessorKey: "promptPrice",
    header: ({ column }) => (
      <div className="flex justify-end">
        <DataTableColumnHeader column={column} title="Prompt" />
      </div>
    ),
    cell: ({ row }) => {
      const inputPrice = row.original.promptPrice;

      const formattedPrice = formatPricePerMillion(inputPrice);

      return (
        <div className="text-right">
          {formattedPrice === "Free" ? (
            <span className="font-mono text-foreground">Free</span>
          ) : (
            <>
              <span className="font-mono">{formattedPrice}</span>{" "}
              <span className="font-mono text-foreground/70">/M</span>
            </>
          )}
        </div>
      );
    },
    filterFn: "inNumberRange",
    size: 150,
    minSize: 150,
    meta: {
      cellClassName: "text-right min-w-[150px]",
      headerClassName: "text-right min-w-[150px]",
    },
  },
  {
    id: "outputPrice",
    accessorKey: "completionPrice",
    header: ({ column }) => (
      <div className="flex justify-end">
        <DataTableColumnHeader column={column} title="Output" />
      </div>
    ),
    cell: ({ row }) => {
      const outputPrice = row.original.completionPrice;

      const formattedPrice = formatPricePerMillion(outputPrice);

      return (
        <div className="text-right">
          {formattedPrice === "Free" ? (
            <span className="font-mono text-foreground">Free</span>
          ) : (
            <>
              <span className="font-mono">{formattedPrice}</span>{" "}
              <span className="font-mono text-foreground/70">/M</span>
            </>
          )}
        </div>
      );
    },
    filterFn: "inNumberRange",
    size: 150,
    minSize: 150,
    meta: {
      cellClassName: "text-right min-w-[150px]",
      headerClassName: "text-right min-w-[150px]",
    },
  },
];
