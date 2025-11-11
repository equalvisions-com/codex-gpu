"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { SheetLineChart } from "@/components/charts/sheet-line-chart";

type PriceHistoryPoint = {
  observedAt: string;
  priceUsd: number;
};

type PriceHistoryResponse = {
  stableKey: string;
  series: PriceHistoryPoint[];
};

interface GpuSheetChartsProps {
  stableKey?: string | null;
}

export function GpuSheetCharts({ stableKey }: GpuSheetChartsProps) {
  const enabled = Boolean(stableKey);

  const normalizeObservedAt = React.useCallback((value?: string) => {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString();
  }, []);

  const historyQuery = useQuery<PriceHistoryResponse>({
    queryKey: ["gpu-price-history", stableKey],
    enabled,
    staleTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!stableKey) {
        throw new Error("Missing stable key");
      }
      const params = new URLSearchParams({ stableKey, refresh: "1" });
      const res = await fetch(`/api/gpus/price-history?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`Failed to load GPU price history (${res.status})`);
      }
      return res.json();
    },
  });

  const chartData = React.useMemo(() => {
    if (!historyQuery.data?.series) {
      return [] as { value: number; observedAt?: string }[];
    }
    return historyQuery.data.series.map((point) => ({
      value: point.priceUsd,
      observedAt: normalizeObservedAt(point.observedAt),
    }));
  }, [historyQuery.data, normalizeObservedAt]);

  const averagePrice = React.useMemo(() => {
    if (!chartData.length) return null;
    const sum = chartData.reduce((total, point) => total + point.value, 0);
    return sum / chartData.length;
  }, [chartData]);

  const description = averagePrice != null
    ? `${averagePrice.toLocaleString(undefined, { maximumFractionDigits: 4 })} usd/hr avg`
    : "usd/hr";

  const emptyMessage = !stableKey
    ? "Select a configuration to load pricing history."
    : historyQuery.isError
      ? "Unable to load pricing history."
      : "No pricing history yet.";

  const isLoading = historyQuery.fetchStatus === "fetching" && !historyQuery.data;

  return (
    <SheetLineChart
      title="Pricing"
      description={description}
      data={chartData}
      stroke="hsl(var(--chart-2))"
      isLoading={isLoading}
      emptyMessage={emptyMessage}
      valueLabel="USD"
      valueFormatter={(value) => `$${value.toFixed(2)}`}
    />
  );
}
