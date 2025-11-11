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
import { SheetLineChart } from "@/components/charts/sheet-line-chart";
import { useQueries } from "@tanstack/react-query";

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
      <DialogContent className="max-w-3xl bg-background">
        <DialogHeader>
          <DialogTitle>Compare configurations</DialogTitle>
          <DialogDescription>
            Side-by-side details for the selected rows.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-2">
          {rows.map((row, index) => {
            const data = row.original as ColumnSchema;
            const stableKey =
              (data as any).stable_key ??
              (data as any).stableKey ??
              null;

            return (
              <div
                key={row.id ?? `compare-${index}`}
                className="rounded-xl border border-border/60 bg-background/60 p-4 space-y-4"
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
            <GpuCompareChart rows={rows} dialogOpen={open} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type PriceHistoryPoint = {
  observedAt: string;
  priceUsd: number;
};

type PriceHistoryResponse = {
  stableKey: string;
  series: PriceHistoryPoint[];
};

async function fetchPriceHistory(stableKey: string) {
  const params = new URLSearchParams({ stableKey, refresh: "1" });
  const res = await fetch(`/api/gpus/price-history?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to load GPU price history (${res.status})`);
  }
  return (await res.json()) as PriceHistoryResponse;
}

function GpuCompareChart({
  rows,
  dialogOpen,
}: {
  rows: Row<ColumnSchema>[];
  dialogOpen: boolean;
}) {
  const targets = React.useMemo(() => {
    return rows
      .map((row, index) => {
        const data = row.original as ColumnSchema;
        const stableKey =
          (data as any).stable_key ??
          (data as any).stableKey ??
          null;
        if (!stableKey) return null;
        return {
          stableKey,
          label:
            data.gpu_model ??
            data.item ??
            data.sku ??
            `Configuration ${index + 1}`,
          color: `hsl(var(--chart-${(index % 5) + 1}))`,
        };
      })
      .filter((target): target is NonNullable<typeof target> => Boolean(target));
  }, [rows]);

  const historyQueries = useQueries({
    queries: targets.map((target) => ({
      queryKey: ["gpu-price-history", target.stableKey],
      enabled: dialogOpen,
      staleTime: 1000 * 60 * 15,
      refetchOnWindowFocus: false,
      queryFn: () => fetchPriceHistory(target.stableKey),
    })),
  });

  const series = React.useMemo(() => {
    return targets.map((target, index) => {
      const data = historyQueries[index]?.data?.series ?? [];
      return {
        id: target.stableKey,
        label: target.label,
        color: target.color,
        data: data.map((point) => ({
          value: point.priceUsd,
          observedAt: point.observedAt,
        })),
      };
    });
  }, [targets, historyQueries]);

  const isLoading = historyQueries.some(
    (query) => query.isPending || query.isFetching,
  );
  const hasError = historyQueries.some((query) => query.isError);

  const emptyMessage = !targets.length
    ? "Select configurations with pricing history."
    : hasError
      ? "Unable to load pricing history."
      : "No pricing history yet.";

  return (
    <SheetLineChart
      title="Pricing"
      description={
        targets.length
          ? `Comparing ${targets.length} ${targets.length === 1 ? "configuration" : "configurations"}`
          : undefined
      }
      series={series}
      isLoading={isLoading}
      emptyMessage={emptyMessage}
      valueLabel="USD"
      valueFormatter={(value) => `$${value.toFixed(4)}`}
    />
  );
}
