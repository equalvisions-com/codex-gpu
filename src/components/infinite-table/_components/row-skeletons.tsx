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

// React Compiler automatically memoizes components in production
// Manual React.memo conflicts with compiler optimizations
// Let the compiler handle memoization automatically
export function RowSkeletons<TData>({
  table,
  rows = 10,
  modelColumnWidth,
}: RowSkeletonsProps<TData>) {
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

  return (
    <React.Fragment>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <SkeletonRow
          key={`skeleton-row-${rowIndex}-${rows}`}
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
 * Separating into individual components helps React process rows efficiently
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
