"use client";

import { useDataTable } from "@/components/data-table/data-table-provider";
import { formatCompactNumber } from "@/lib/format";
import { useMemo } from "react";
import { DataTableFilterControlsDrawer } from "./data-table-filter-controls-drawer";
import { DataTableResetButton } from "./data-table-reset-button";

interface DataTableToolbarProps {
  renderActions?: () => React.ReactNode;
}

export function DataTableToolbar({ renderActions }: DataTableToolbarProps) {
  const { table, isLoading, columnFilters, search } = useDataTable();
  const filters = table.getState().columnFilters;

  // Server-mode: render counts based on meta passed into sheet/details.
  // Fallback to current page counts if meta is unavailable
  const rows = useMemo(() => {
    const total = (table.options.meta as any)?.metadata?.totalRows ?? table.getCoreRowModel().rows.length;
    const filtered = (table.options.meta as any)?.metadata?.filterRows ?? table.getCoreRowModel().rows.length;
    return { total, filtered };
  }, [isLoading, columnFilters, table]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="block sm:hidden">
          <DataTableFilterControlsDrawer />
        </div>
        <div>
          <p className="hidden text-sm text-muted-foreground">
            <span className="font-mono">
              {formatCompactNumber(rows.filtered)}
            </span>{" "}
            of{" "}
            <span className="font-mono">
              {formatCompactNumber(rows.total)}
            </span>{" "}
            row(s) <span className="sr-only sm:not-sr-only">filtered</span>
          </p>
          <p className="hidden text-sm text-muted-foreground">
            <span className="font-mono">
              {formatCompactNumber(rows.filtered)}
            </span>{" "}
            row(s)
          </p>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {(filters.length || search) ? <DataTableResetButton /> : null}
        {renderActions?.()}
      </div>
    </div>
  );
}
