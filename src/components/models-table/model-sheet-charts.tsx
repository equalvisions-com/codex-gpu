"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Line,
  LineChart,
  XAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type ThroughputApiResponse = {
  permaslug: string;
  endpointId: string | null;
  series: {
    endpointId: string;
    provider?: string | null;
    data: { observedAt: string; throughput: number }[];
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
  data: { label: string; value: number }[];
  isLoading?: boolean;
  emptyMessage?: string;
};

const latencyPlaceholderData: SheetLineChartProps["data"] = [
  { label: "Mon", value: 180 },
  { label: "Tue", value: 330 },
  { label: "Wed", value: 260 },
  { label: "Thu", value: 420 },
  { label: "Fri", value: 240 },
  { label: "Sat", value: 510 },
  { label: "Sun", value: 290 },
];

function SheetLineChart({
  title,
  description,
  stroke = "hsl(var(--chart-1))",
  data,
  isLoading,
  emptyMessage,
}: SheetLineChartProps) {
  const showEmpty = !isLoading && data.length === 0;

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
              <LineChart data={data}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  fontSize={12}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                    fontSize: "0.75rem",
                  }}
                  labelClassName="font-medium"
                  formatter={(value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                />
                <Line
                  type="natural"
                  dot={false}
                  dataKey="value"
                  stroke={stroke}
                  strokeWidth={2}
                  activeDot={{ r: 4 }}
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
  const formatter = React.useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      }),
    [],
  );

  const throughputQuery = useQuery<ThroughputApiResponse>({
    queryKey: ["model-throughput", permaslug, endpointId],
    enabled: Boolean(permaslug && endpointId),
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

  const throughputData = React.useMemo(() => {
    const series = throughputQuery.data?.series?.[0];
    if (!series || !Array.isArray(series.data)) {
      return [] as SheetLineChartProps["data"];
    }

    return series.data.map((point) => {
      const date = new Date(point.observedAt);
      const label = Number.isNaN(date.getTime()) ? point.observedAt : formatter.format(date);
      return { label, value: point.throughput };
    });
  }, [throughputQuery.data, formatter]);

  const throughputDescription = provider ? `${provider} · tokens/sec` : "Tokens/sec";
  const missingSelection = !permaslug || !endpointId;
  const emptyMessage = missingSelection
    ? "Select a provider variant to load throughput."
    : throughputQuery.isError
      ? "Unable to load throughput data."
      : "No throughput samples yet.";

  return (
    <div className="grid gap-4 border-t border-border/70 pt-4">
      <SheetLineChart
        title="Throughput"
        description={throughputDescription}
        data={throughputData}
        stroke="hsl(var(--chart-1))"
        isLoading={throughputQuery.isPending || throughputQuery.isFetching}
        emptyMessage={emptyMessage}
      />
      <SheetLineChart
        title="Latency"
        description="SECONDS"
        data={latencyPlaceholderData}
        stroke="hsl(var(--chart-2))"
      />
    </div>
  );
}
