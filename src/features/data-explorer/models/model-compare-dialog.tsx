"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Row, Table as TanstackTable } from "@tanstack/react-table";
import { MemoizedDataTableSheetContent } from "@/features/data-explorer/data-table/data-table-sheet/data-table-sheet-content";
import { filterFields, sheetFields } from "./models-constants";
import type { ModelsColumnSchema } from "./models-schema";
// Use next/dynamic with ssr: false for truly client-only lazy loading
// This prevents any SSR/prefetching and ensures components only load when dialog is opened
import dynamic from "next/dynamic";

const LazyModelComparisonCharts = dynamic(
  () => import("./model-comparison-charts").then((module) => ({
    default: module.ModelComparisonCharts,
  })),
  {
    ssr: false, // Client-only - only loads when compare dialog is opened
  },
);

interface ModelCompareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: Row<ModelsColumnSchema>[];
  table: TanstackTable<ModelsColumnSchema>;
}

export function ModelCompareDialog({
  open,
  onOpenChange,
  rows,
  table,
}: ModelCompareDialogProps) {
  if (!rows.length) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-background p-4 sm:p-4 border border-border/60 [&>button:last-of-type]:right-4 [&>button:last-of-type]:top-4">
        <DialogHeader>
          <DialogTitle>Model Comparison</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((row, index) => {
            const data = row.original as ModelsColumnSchema;
            return (
              <div
                key={row.id ?? `model-compare-${index}`}
                className="rounded-xl border border-border/60 bg-background/80 px-4 pt-4 pb-2 space-y-4"
              >
                <MemoizedDataTableSheetContent
                  table={table}
                  data={data}
                  filterFields={filterFields}
                  fields={sheetFields}
                  metadata={{
                    titleClassName: "text-base font-semibold leading-none tracking-tight mb-1",
                  }}
                />
              </div>
            );
          })}
          {rows.length === 1 ? (
            <div className="hidden md:flex items-center justify-center rounded-xl border border-dashed border-border/60 text-sm text-muted-foreground">
              Select another model to compare side by side.
            </div>
          ) : null}
          <div className="md:col-span-2 space-y-4">
            {/* Removed React.Suspense wrapper as next/dynamic handles it */}
            <LazyModelComparisonCharts rows={rows} dialogOpen={open} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
