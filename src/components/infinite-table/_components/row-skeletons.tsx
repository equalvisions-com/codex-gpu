"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/custom/table";
import { cn } from "@/lib/utils";
import type { Table as TTable } from "@tanstack/react-table";
import * as React from "react";

interface RowSkeletonsProps<TData> {
  table: TTable<TData>;
  rows?: number;
  modelColumnWidth: string;
}

function RowSkeletonsComponent<TData>({
  table,
  rows = 10,
  modelColumnWidth,
}: RowSkeletonsProps<TData>) {
  const visibleColumns = React.useMemo(
    () => table.getVisibleLeafColumns(),
    [table]
  );

  // Use useLayoutEffect to ensure skeletons render synchronously before browser paint
  React.useLayoutEffect(() => {
    // Force browser to render skeletons immediately by accessing layout properties
    // This prevents React from deferring rendering during fast scrolling
    const forceLayout = () => {
      if (typeof document !== 'undefined') {
        // Accessing document.body forces a layout recalculation
        void document.body.offsetHeight;
      }
    };
    // Use requestAnimationFrame to ensure this runs after React commits but before paint
    requestAnimationFrame(forceLayout);
  }, [rows, visibleColumns.length]);

  return (
    <React.Fragment>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow
          key={`skeleton-row-${rowIndex}-${rows}`}
          className={cn("[&>:not(:last-child)]:border-r", "hover:bg-transparent")}
        >
          {visibleColumns.map((column) => {
            const id = column.id;
            const isModelColumn = id === "gpu_model" || id === "name";
            const width = isModelColumn ? modelColumnWidth : column.getSize();

            return (
              <TableCell
                key={`${id}-${rowIndex}`}
                className={cn(
                  "truncate border-b border-border p-[12px]",
                  isModelColumn && "bg-background shadow-[inset_-1px_0_0_var(--border)]",
                  column.columnDef.meta?.cellClassName,
                )}
                style={{
                  width,
                  minWidth: isModelColumn ? modelColumnWidth : column.columnDef.minSize,
                  maxWidth: isModelColumn ? modelColumnWidth : undefined,
                }}
              >
                {id === "blank" ? (
                  <div className="flex justify-center">
                    <Skeleton className="h-4 w-4 rounded-sm" />
                  </div>
                ) : id === "provider" ? (
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <Skeleton className="h-4 w-[6rem]" />
                  </div>
                ) : id === "gpu_model" ? (
                  <Skeleton className="h-4 w-full" />
                ) : id === "price_hour_usd" ? (
                  <div className="flex items-center justify-center">
                    <Skeleton className="h-4 w-10" />
                  </div>
                ) : id === "gpu_count" ? (
                  <div className="flex items-center justify-center">
                    <Skeleton className="h-4 w-10" />
                  </div>
                ) : id === "vram_gb" || id === "system_ram_gb" ? (
                  <div className="flex items-center justify-center">
                    <Skeleton className="h-4 w-10" />
                  </div>
                ) : id === "vcpus" ? (
                  <div className="flex items-center justify-center">
                    <Skeleton className="h-4 w-10" />
                  </div>
                ) : id === "type" ? (
                  <div className="flex items-center justify-center">
                    <Skeleton className="h-4 w-10" />
                  </div>
                ) : id === "contextLength" ||
                  id === "mmlu" ||
                  id === "inputModalities" ||
                  id === "inputPrice" ||
                  id === "outputPrice" ? (
                  <div className="flex items-center justify-end">
                    <Skeleton className="h-4 w-16" />
                  </div>
                ) : (
                  <Skeleton className="h-4 w-[14rem]" />
                )}
              </TableCell>
            );
          })}
        </TableRow>
      ))}
    </React.Fragment>
  );
}

// Simplified memo comparison - only check props that actually matter
// Don't check table columns in comparison as it's expensive and causes rendering issues
export const RowSkeletons = React.memo(
  RowSkeletonsComponent,
  (prev, next) => {
    // Only compare the props that actually affect rendering
    // Checking table columns is expensive and causes React to defer rendering
    return (
      prev.rows === next.rows &&
      prev.modelColumnWidth === next.modelColumnWidth &&
      prev.table === next.table
    );
  }
) as typeof RowSkeletonsComponent;
