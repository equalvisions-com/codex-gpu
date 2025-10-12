"use client";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTableColumnCompanyLogo } from "@/components/data-table/data-table-column/data-table-column-company-logo";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useDataTable } from "@/components/data-table/data-table-provider";
import type { ColumnDef } from "@tanstack/react-table";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import type { ModelsColumnSchema } from "./models-schema";

function RowCheckboxCell({ rowId }: { rowId: string }) {
  const { checkedRows, toggleCheckedRow } = useDataTable<ModelsColumnSchema, unknown>();
  const isChecked = checkedRows[rowId] ?? false;
  return (
    <Checkbox
      checked={isChecked}
      onCheckedChange={(next) => toggleCheckedRow(rowId, Boolean(next))}
      aria-label={`Check row ${rowId}`}
    />
  );
}

function formatPricing(pricing: Record<string, any>): string {
  if (!pricing || typeof pricing !== 'object') return 'N/A';

  const parts = [];
  if (pricing.prompt && typeof pricing.prompt === 'number') {
    parts.push(`Prompt: $${pricing.prompt}/1K`);
  }
  if (pricing.completion && typeof pricing.completion === 'number') {
    parts.push(`Completion: $${pricing.completion}/1K`);
  }
  if (pricing.request && typeof pricing.request === 'number') {
    parts.push(`Request: $${pricing.request}`);
  }

  return parts.length > 0 ? parts.join(', ') : 'Free';
}

export const modelsColumns: ColumnDef<ModelsColumnSchema>[] = [
  {
    accessorKey: "provider",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Provider" />
    ),
    cell: ({ row }) => {
      const provider = row.getValue<ModelsColumnSchema["provider"]>("provider");
      return (
        <div className="flex items-center gap-2">
          <DataTableColumnCompanyLogo provider={provider} />
          <span className="capitalize">{provider}</span>
        </div>
      );
    },
    size: 150,
    minSize: 120,
    maxSize: 200,
  },
  {
    accessorKey: "shortName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Model Name" />
    ),
    cell: ({ row }) => {
      const shortName = row.getValue<ModelsColumnSchema["shortName"]>("shortName");
      const name = row.original.name;
      const displayName = shortName || name;

      if (!displayName) return <span className="text-muted-foreground">Unknown</span>;

      return (
        <div className="max-w-[300px] truncate font-medium">
          {displayName}
        </div>
      );
    },
    size: 250,
    minSize: 200,
    maxSize: 400,
  },
  {
    accessorKey: "description",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Description" />
    ),
    cell: ({ row }) => {
      const description = row.getValue<ModelsColumnSchema["description"]>("description");

      if (!description) return <span className="text-muted-foreground">No description</span>;

      return (
        <div className="max-w-[400px]">
          <HoverCard>
            <HoverCardTrigger asChild>
              <div className="truncate cursor-help">
                {description}
              </div>
            </HoverCardTrigger>
            <HoverCardContent className="max-w-[500px] p-4">
              <p className="text-sm">{description}</p>
            </HoverCardContent>
          </HoverCard>
        </div>
      );
    },
    size: 300,
    minSize: 250,
    maxSize: 500,
  },
  {
    accessorKey: "pricing",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Pricing" />
    ),
    cell: ({ row }) => {
      const pricing = row.getValue<ModelsColumnSchema["pricing"]>("pricing");
      const formatted = formatPricing(pricing);

      return (
        <div className="font-mono text-sm">
          {formatted}
        </div>
      );
    },
    size: 250,
    minSize: 200,
    maxSize: 350,
  },
];
