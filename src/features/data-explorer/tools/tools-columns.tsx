"use client";

import { DataTableColumnHeader } from "@/features/data-explorer/data-table/data-table-column-header";
import { DataTableHeaderCheckbox } from "@/features/data-explorer/data-table/data-table-header-checkbox";
import { Checkbox } from "@/components/ui/checkbox";
import { useDataTable } from "@/features/data-explorer/data-table/data-table-provider";
import type { ColumnDef } from "@tanstack/react-table";
import type { ToolColumnSchema } from "./tools-schema";
import { getToolProviderLogo } from "./tool-provider-logos";
import Image from "next/image";

function RowCheckboxCell({ rowId }: { rowId: string }) {
  const { checkedRows, toggleCheckedRow } = useDataTable<ToolColumnSchema, unknown>();
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

export const toolsColumns: ColumnDef<ToolColumnSchema>[] = [
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
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" className="pl-0 pr-[12px]" />
    ),
    cell: ({ row }) => {
      const name = row.original.name ?? "";
      const logo = getToolProviderLogo(name);
      const fallbackInitial = name ? name.charAt(0).toUpperCase() : "";
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
          <span className="truncate" title={name || undefined}>
            {name || "Unknown"}
          </span>
        </div>
      );
    },
    size: 171,
    minSize: 171,
    meta: {
      cellClassName: "text-left min-w-[171px] pl-0",
      headerClassName: "text-left min-w-[171px] pl-0",
      skeletonVariant: "provider",
    },
  },
  {
    accessorKey: "description",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Description" />,
    cell: ({ row }) => {
      const description = row.original.description;
      return (
        <span className="block truncate text-foreground/90">
          {description || "No description available"}
        </span>
      );
    },
    size: 275,
    minSize: 275,
    meta: {
      cellClassName: "text-left overflow-hidden min-w-[275px] pr-0",
      headerClassName: "text-left overflow-hidden min-w-[275px]",
    },
  },
  {
    accessorKey: "category",
    header: ({ column }) => (
      <div className="flex justify-start">
        <DataTableColumnHeader column={column} title="Category" />
      </div>
    ),
    cell: ({ row }) => {
      const category = row.original.category;
      if (!category) {
        return <span className="block truncate text-left text-muted-foreground">N/A</span>;
      }
      return (
        <div className="flex justify-start">
          <span className="block max-w-full truncate text-[12px] border border-border/70 w-fit bg-background leading-[18px] rounded-sm h-[20px] px-[6px]">
            {category}
          </span>
        </div>
      );
    },
    size: 200,
    minSize: 200,
    meta: {
      cellClassName: "text-left min-w-[200px]",
      headerClassName: "text-left min-w-[200px]",
    },
  },
  {
    accessorKey: "developer",
    header: ({ column }) => (
      <div className="flex justify-end">
        <DataTableColumnHeader column={column} title="Developer" />
      </div>
    ),
    cell: ({ row }) => {
      const developer = row.original.developer;
      if (!developer) {
        return <span className="block truncate text-right text-muted-foreground">N/A</span>;
      }
      return <span className="block truncate text-right">{developer}</span>;
    },
    size: 150,
    minSize: 150,
    meta: {
      cellClassName: "text-right min-w-[150px]",
      headerClassName: "text-right min-w-[150px]",
    },
  },
  {
    accessorKey: "stack",
    header: ({ column }) => (
      <div className="flex justify-end">
        <DataTableColumnHeader column={column} title="Stack" />
      </div>
    ),
    cell: ({ row }) => {
      const stack = row.original.stack;
      if (!stack) {
        return <span className="block truncate text-right text-muted-foreground">N/A</span>;
      }
      return <span className="block truncate text-right">{stack}</span>;
    },
    size: 150,
    minSize: 150,
    meta: {
      cellClassName: "text-right min-w-[150px]",
      headerClassName: "text-right min-w-[150px]",
    },
  },
  {
    accessorKey: "price",
    header: ({ column }) => (
      <div className="flex justify-end">
        <DataTableColumnHeader column={column} title="Price" />
      </div>
    ),
    cell: ({ row }) => {
      const price = row.original.price;
      if (!price) {
        return <span className="block truncate text-right text-muted-foreground">N/A</span>;
      }
      return <span className="block truncate text-right">{price}</span>;
    },
    size: 150,
    minSize: 150,
    meta: {
      cellClassName: "text-right min-w-[150px]",
      headerClassName: "text-right min-w-[150px]",
    },
  },
  {
    accessorKey: "oss",
    header: ({ column }) => (
      <div className="flex justify-end">
        <DataTableColumnHeader column={column} title="OSS" />
      </div>
    ),
    cell: ({ row }) => {
      const oss = row.original.oss;
      if (oss === null || oss === undefined) {
        return <span className="block truncate text-right text-muted-foreground">N/A</span>;
      }
      const displayOss = typeof oss === "string" ? oss.trim() : String(oss);
      if (!displayOss) {
        return <span className="block truncate text-right text-muted-foreground">N/A</span>;
      }
      return <span className="block truncate text-right">{displayOss}</span>;
    },
    size: 150,
    minSize: 150,
    meta: {
      cellClassName: "text-right min-w-[150px]",
      headerClassName: "text-right min-w-[150px]",
    },
  },
  {
    accessorKey: "license",
    header: ({ column }) => (
      <div className="flex justify-end">
        <DataTableColumnHeader column={column} title="License" />
      </div>
    ),
    cell: ({ row }) => {
      const license = row.original.license;
      if (!license) {
        return <span className="block truncate text-right text-muted-foreground">N/A</span>;
      }
      return <span className="block truncate text-right">{license}</span>;
    },
    size: 150,
    minSize: 150,
    meta: {
      cellClassName: "text-right min-w-[150px]",
      headerClassName: "text-right min-w-[150px]",
    },
  },
];
