"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Line,
  LineChart,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type TimeseriesPoint = { observedAt: string };

type ThroughputApiResponse = {
  permaslug: string;
  endpointId: string | null;
  series: {
    endpointId: string;
    provider?: string | null;
    data: (TimeseriesPoint & { throughput: number })[];
  }[];
};

type LatencyApiResponse = {
  permaslug: string;
  endpointId: string | null;
  series: {
    endpointId: string;
    provider?: string | null;
    data: (TimeseriesPoint & { latency: number })[];
  }[];
};

type ModelSheetChartsProps = {
  permaslug?: string | null;
  endpointId?: string | null;
  provider?: string | null;
};

type SheetLineChartProps = {
  title: string;
  description?: string;
  stroke?: string;
  data: { value: number; observedAt?: string }[];
  isLoading?: boolean;
  emptyMessage?: string;
  valueFormatter?: (value: number) => string;
  valueLabel?: string;
};

function SheetLineChart({
  title,
  description,
  stroke = "hsl(var(--chart-1))",
  data,
  isLoading,
  emptyMessage,
  valueFormatter,
  valueLabel,
}: SheetLineChartProps) {
  const formatLabel = React.useCallback((payload?: any[], fallbackLabel?: string | number) => {
    const raw = (payload?.[0]?.payload?.observedAt as string | undefined) ?? (typeof fallbackLabel === "string" ? fallbackLabel : undefined);
    if (!raw) return "";
    const iso = raw.endsWith("Z") ? raw : `${raw}Z`;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return raw;
    }
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  }, []);
  const showEmpty = !isLoading && data.length === 0;

  const linearDomain = React.useMemo(() => {
    if (data.length === 0) {
      return ["auto", "auto"] as ["auto", "auto"];
    }

    const values = data.map((point) => point.value).filter((value) => Number.isFinite(value));
    if (!values.length) {
      return ["auto", "auto"] as ["auto", "auto"];
    }

    const min = Math.min(...values);
    const max = Math.max(...values);

    if (min === max) {
      const padding = min * 0.1 || 0.1;
      return [min - padding, max + padding] as [number, number];
    }

    const padding = (max - min) * 0.11 || 0.11;
    return [min - padding, max + padding] as [number, number];
  }, [data]);

  return (
    <Card className="border-border/70 bg-muted/30">
      <CardHeader className="space-y-1.5 p-4 pb-1">
        <CardTitle className="text-sm font-medium text-foreground">
          {title}
        </CardTitle>
        {description ? (
          <CardDescription className="text-xs text-foreground/70">
            {description}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="p-4">
        <div className="h-36 w-full">
          {isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : showEmpty ? (
            <div className="flex h-full items-center justify-center text-xs text-foreground/70">
              {emptyMessage ?? "No data available."}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <YAxis hide domain={linearDomain} tickCount={5} />
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border))"
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                    fontSize: "0.75rem",
                  }}
                  labelClassName="font-medium"
                  formatter={(value: number) =>
                    [
                      valueFormatter
                        ? valueFormatter(value)
                        : value.toLocaleString(undefined, { maximumFractionDigits: 2 }),
                      valueLabel ?? "value",
                    ]}
                  labelFormatter={(label, payload) => formatLabel(payload, label)}
                  content={({ payload, label }) => {
                    if (!payload?.length) return null;
                    return (
                      <div
                        className="recharts-default-tooltip"
                        style={{
                          background: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "0.5rem",
                          fontSize: "0.75rem",
                          padding: "0.5rem 0.75rem",
                          color: stroke,
                        }}
                      >
                        <div className="font-medium" style={{ color: "hsl(var(--foreground))" }}>
                          {formatLabel(payload as any, label as any)}
                        </div>
                        <div
                          className="recharts-tooltip-item-list flex"
                          style={{ height: "18px", alignItems: "center", gap: "0.5rem" }}
                        >
                          {payload.map((entry, index) => (
                            <div key={index} className="flex items-center gap-2 text-xs">
                              <span>
                                {valueFormatter
                                  ? valueFormatter(entry.value as number)
                                  : (entry.value as number).toLocaleString(undefined, {
                                      maximumFractionDigits: 2,
                                    })}
                              </span>
                              <span>{valueLabel ?? entry.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }}
                />
                <Line
                  type="natural"
                  dot={false}
                  dataKey="value"
                  stroke={stroke}
                  strokeWidth={2}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ModelSheetCharts({ permaslug, endpointId, provider }: ModelSheetChartsProps) {
  const enabled = Boolean(permaslug && endpointId);

  const throughputQuery = useQuery<ThroughputApiResponse>({
    queryKey: ["model-throughput", permaslug, endpointId],
    enabled,
    staleTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!permaslug || !endpointId) {
        throw new Error("Missing throughput identifiers");
      }
      const params = new URLSearchParams({ permaslug, endpointId, refresh: "1" });
      const res = await fetch(`/api/models/throughput?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`Failed to load throughput (${res.status})`);
      }
      return res.json();
    },
  });

  const latencyQuery = useQuery<LatencyApiResponse>({
    queryKey: ["model-latency", permaslug, endpointId],
    enabled,
    staleTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!permaslug || !endpointId) {
        throw new Error("Missing latency identifiers");
      }
      const params = new URLSearchParams({ permaslug, endpointId, refresh: "1" });
      const res = await fetch(`/api/models/latency?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`Failed to load latency (${res.status})`);
      }
      return res.json();
    },
  });

  const throughputData = React.useMemo(() => {
    const series = throughputQuery.data?.series?.[0];
    if (!series || !Array.isArray(series.data)) {
      return [] as SheetLineChartProps["data"];
    }

    return series.data.map((point) => ({
      value: point.throughput,
      observedAt: point.observedAt,
    }));
  }, [throughputQuery.data]);

  const throughputAverage = React.useMemo(() => {
    if (!throughputData.length) {
      return null;
    }
    const sum = throughputData.reduce((total, point) => total + point.value, 0);
    return sum / throughputData.length;
  }, [throughputData]);

  const latencyData = React.useMemo(() => {
    const series = latencyQuery.data?.series?.[0];
    if (!series || !Array.isArray(series.data)) {
      return [] as SheetLineChartProps["data"];
    }

    return series.data.map((point) => ({
      value: point.latency / 1000,
      observedAt: point.observedAt,
    }));
  }, [latencyQuery.data]);

  const latencyAverage = React.useMemo(() => {
    if (!latencyData.length) {
      return null;
    }
    const sum = latencyData.reduce((total, point) => total + point.value, 0);
    return sum / latencyData.length;
  }, [latencyData]);

  const latencyValueFormatter = React.useCallback((value: number) => {
    return value >= 1 ? value.toFixed(2) : value.toFixed(3);
  }, []);

  const throughputDescription = throughputAverage != null
    ? `${throughputAverage.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })} tok/s avg`
    : "tok/s avg";
  const latencyDescription = latencyAverage != null
    ? `${latencyAverage.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })} secs avg`
    : "secs avg";
  const missingSelection = !permaslug || !endpointId;
  const emptyMessage = missingSelection
    ? "Select a provider variant to load throughput."
    : throughputQuery.isError
      ? "Unable to load throughput data."
      : "No throughput samples yet.";
  const latencyEmptyMessage = missingSelection
    ? "Select a provider variant to load latency."
    : latencyQuery.isError
      ? "Unable to load latency data."
      : "No latency samples yet.";

  return (
    <div className="grid gap-4 border-t border-border/70 pt-4">
      <SheetLineChart
        title="Throughput"
        description={throughputDescription}
        data={throughputData}
        stroke="hsl(var(--chart-1))"
        isLoading={throughputQuery.isPending || throughputQuery.isFetching}
        emptyMessage={emptyMessage}
        valueLabel="TOK/S"
      />
      <SheetLineChart
        title="Latency"
        description={latencyDescription}
        data={latencyData}
        stroke="hsl(var(--chart-2))"
        isLoading={latencyQuery.isPending || latencyQuery.isFetching}
        emptyMessage={latencyEmptyMessage}
        valueFormatter={latencyValueFormatter}
        valueLabel="Seconds"
      />
    </div>
  );
}
