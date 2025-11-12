"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MemoizedDataTableSheetContent } from "@/components/data-table/data-table-sheet/data-table-sheet-content";
import type { Table as TanStackTable, Row } from "@tanstack/react-table";
import type { ColumnSchema } from "@/components/infinite-table/schema";
import { filterFields, sheetFields } from "@/components/infinite-table/constants";

const LazyGpuCompareChart = React.lazy(() =>
  import("./gpu-compare-chart").then((module) => ({
    default: module.GpuCompareChart,
  })),
);

interface CompareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: Row<ColumnSchema>[];
  table: TanStackTable<ColumnSchema>;
}

export function CompareDialog({
  open,
  onOpenChange,
  rows,
  table,
}: CompareDialogProps) {
  if (!rows.length) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-background p-4 sm:p-4 border border-border/60 [&>button:last-of-type]:right-4 [&>button:last-of-type]:top-4">
        <DialogHeader>
          <DialogTitle>Compare GPUs</DialogTitle>
          <DialogDescription>
            Review selected GPU configurations and inspect pricing history.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((row, index) => {
            const data = row.original as ColumnSchema;

            return (
              <div
                key={row.id ?? `compare-${index}`}
                className="rounded-xl border border-border/60 bg-background/60 px-4 pt-4 pb-2 space-y-4"
              >
                <MemoizedDataTableSheetContent
                  table={table}
                  data={data}
                  filterFields={filterFields}
                  fields={sheetFields}
                />
              </div>
            );
          })}
          {rows.length === 1 ? (
            <div className="hidden md:flex items-center justify-center rounded-xl border border-dashed border-border/60 text-sm text-muted-foreground">
              Select another row to compare side by side.
            </div>
          ) : null}
          <div className="md:col-span-2">
            <React.Suspense
              fallback={
                <div className="grid gap-4">
                  <div className="h-40 animate-pulse rounded-xl bg-muted" />
                  <div className="h-40 animate-pulse rounded-xl bg-muted" />
                </div>
              }
            >
              <LazyGpuCompareChart rows={rows} dialogOpen={open} />
            </React.Suspense>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
