"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/custom/table";
import { cn } from "@/lib/utils";
import type { Table as TTable } from "@tanstack/react-table";

interface RowSkeletonsProps<TData> {
  table: TTable<TData>;
  rows?: number;
  modelColumnWidth: string;
}

export function RowSkeletons<TData>({
  table,
  rows = 10,
  modelColumnWidth,
}: RowSkeletonsProps<TData>) {
  const visibleColumns = table.getVisibleLeafColumns();

  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow
          key={`skeleton-${rowIndex}`}
          className={cn(
            "bg-background border-b transition-colors [&>:not(:last-child)]:border-r",
            "hover:bg-transparent",
          )}
        >
          {visibleColumns.map((column) => {
            const id = column.id;
            const isModelColumn = id === "gpu_model" || id === "name";
            const cellClassName = column.columnDef.meta?.cellClassName;

            return (
              <TableCell
                key={`${id}-${rowIndex}`}
                className={cn(
                  "truncate border-b border-border p-[12px]",
                  isModelColumn && "bg-background shadow-[inset_-1px_0_0_var(--border)]",
                  cellClassName,
                )}
                style={{
                  ...(isModelColumn
                    ? {
                        width: modelColumnWidth,
                        minWidth: modelColumnWidth,
                        maxWidth: modelColumnWidth,
                      }
                    : {
                        width: column.getSize(),
                        minWidth: column.columnDef.minSize,
                      }),
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
                ) : isModelColumn ? (
                  <Skeleton className="h-4 w-36 sm:w-48" />
                ) : (
                  <div className="flex items-center justify-end">
                    <Skeleton className="h-4 w-16" />
                  </div>
                )}
              </TableCell>
            );
          })}
        </TableRow>
      ))}
    </>
  );
}
