"use client";

import * as React from "react";
import type { Row } from "@tanstack/react-table";
import type { ColumnSchema } from "@/components/infinite-table/schema";
import { SheetLineChart } from "@/components/charts/sheet-line-chart";
import { ChartLegend } from "@/components/charts/chart-legend";
import { useQueries } from "@tanstack/react-query";

type PriceHistoryPoint = {
  observedAt: string;
  priceUsd: number;
};

type PriceHistoryResponse = {
  stableKey: string;
  series: PriceHistoryPoint[];
};

async function fetchPriceHistory(stableKey: string) {
  const params = new URLSearchParams({ stableKey });
  const res = await fetch(`/api/gpus/price-history?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to load GPU price history (${res.status})`);
  }
  return (await res.json()) as PriceHistoryResponse;
}

export function GpuCompareChart({
  rows,
  dialogOpen,
}: {
  rows: Row<ColumnSchema>[];
  dialogOpen: boolean;
}) {
  const normalizeObservedAt = React.useCallback((value?: string) => {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString();
  }, []);

  const targets = React.useMemo(() => {
    return rows
      .map((row, index) => {
        const data = row.original as ColumnSchema;
        const stableKey =
          (data as any).stable_key ??
          (data as any).stableKey ??
          null;
        if (!stableKey) return null;
        const providerName = data.provider
          ? data.provider.charAt(0).toUpperCase() + data.provider.slice(1)
          : null;
        const baseLabel =
          data.gpu_model ??
          data.item ??
          data.sku ??
          `Configuration ${index + 1}`;
        return {
          stableKey,
          label: baseLabel,
          provider: providerName ?? undefined,
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
          observedAt: normalizeObservedAt(point.observedAt),
        })),
      };
    });
  }, [targets, historyQueries, normalizeObservedAt]);

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
        targets.length ? (
          <ChartLegend
            layout="stacked"
            items={targets.map((target) => ({
              id: target.stableKey,
              label: target.label,
              provider: target.provider,
              color: target.color,
            }))}
          />
        ) : undefined
      }
      series={series}
      isLoading={isLoading}
      emptyMessage={emptyMessage}
      valueLabel="USD"
      valueFormatter={(value) => `$${value.toFixed(2)} hr`}
    />
  );
}
