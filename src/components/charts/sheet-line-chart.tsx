"use client";

import * as React from "react";
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

export type SheetLineChartProps = {
  title: string;
  description?: string;
  stroke?: string;
  data: { value: number; observedAt?: string }[];
  isLoading?: boolean;
  emptyMessage?: string;
  valueFormatter?: (value: number) => string;
  valueLabel?: string;
};

export function SheetLineChart({
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
    const values = data.map((point) => point.value).filter((value) => Number.isFinite(value));

    if (!values.length) {
      return [0, 1] as [number, number];
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
              <LineChart data={data} margin={{ top: 4, right: 0, bottom: 4, left: 0 }}>
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
                  labelFormatter={(label, payload) => formatLabel(payload, label)}
                  formatter={(value: number) =>
                    [
                      valueFormatter
                        ? valueFormatter(value)
                        : value.toLocaleString(undefined, { maximumFractionDigits: 2 }),
                      valueLabel ?? "value",
                    ]}
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
