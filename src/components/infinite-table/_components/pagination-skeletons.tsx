"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/custom/table";
import { cn } from "@/lib/utils";
import type { Table as TTable } from "@tanstack/react-table";
import * as React from "react";

interface PaginationSkeletonsProps<TData> {
  table: TTable<TData>;
  modelColumnWidth: string;
}

/**
 * Dedicated skeleton component for pagination loading
 * Always renders exactly 15 rows - hardcoded for reliability
 * 
 * Simple, direct rendering - no progressive loading, no batching
 * React Compiler will optimize this component appropriately
 */
export function PaginationSkeletons<TData>({
  table,
  modelColumnWidth,
}: PaginationSkeletonsProps<TData>) {
  const visibleColumns = React.useMemo(
    () => table.getVisibleLeafColumns(),
    [table]
  );

  // Memoize column configuration to avoid recalculation
  const columnConfigs = React.useMemo(
    () =>
      visibleColumns.map((column) => {
        const id = column.id;
        const isModelColumn = id === "gpu_model" || id === "name";
        return {
          id,
          isModelColumn,
          width: isModelColumn ? modelColumnWidth : column.getSize(),
          minSize: column.columnDef.minSize,
          cellClassName: column.columnDef.meta?.cellClassName,
        };
      }),
    [visibleColumns, modelColumnWidth]
  );

  // Always render all 15 rows immediately - no batching, no progressive rendering
  // Hardcoded to ensure consistent rendering
  const TOTAL_ROWS = 15;
  
  return (
    <React.Fragment>
      {Array.from({ length: TOTAL_ROWS }).map((_, rowIndex) => (
        <SkeletonRow
          key={`pagination-skeleton-row-${rowIndex}`}
          columnConfigs={columnConfigs}
          rowIndex={rowIndex}
          modelColumnWidth={modelColumnWidth}
        />
      ))}
    </React.Fragment>
  );
}

/**
 * Individual skeleton row component
 * React Compiler automatically memoizes components in production
 */
function SkeletonRow({
  columnConfigs,
  rowIndex,
  modelColumnWidth,
}: {
  columnConfigs: Array<{
    id: string;
    isModelColumn: boolean;
    width: number | string;
    minSize?: number;
    cellClassName?: string;
  }>;
  rowIndex: number;
  modelColumnWidth: string;
}) {
  return (
    <TableRow
      className={cn("[&>:not(:last-child)]:border-r", "hover:bg-transparent")}
    >
      {columnConfigs.map((config) => {
        const { id, isModelColumn, width, minSize, cellClassName } = config;
        return (
          <TableCell
            key={`${id}-${rowIndex}`}
            className={cn(
              "truncate border-b border-border p-[12px]",
              isModelColumn && "bg-background shadow-[inset_-1px_0_0_var(--border)]",
              cellClassName,
            )}
            style={{
              width,
              minWidth: isModelColumn ? modelColumnWidth : minSize,
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
  );
}

