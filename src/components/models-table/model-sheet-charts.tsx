"use client";

import * as React from "react";
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

type SheetLineChartProps = {
  title: string;
  description?: string;
  stroke?: string;
  data: { label: string; value: number }[];
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

const usagePlaceholderData: SheetLineChartProps["data"] = [
  { label: "Mon", value: 28 },
  { label: "Tue", value: 54 },
  { label: "Wed", value: 36 },
  { label: "Thu", value: 72 },
  { label: "Fri", value: 44 },
  { label: "Sat", value: 88 },
  { label: "Sun", value: 60 },
];

function SheetLineChart({
  title,
  description,
  stroke = "hsl(var(--chart-1))",
  data,
}: SheetLineChartProps) {
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
                formatter={(value: number) => value.toLocaleString()}
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
        </div>
      </CardContent>
    </Card>
  );
}

export function ModelSheetCharts() {
  return (
    <div className="grid gap-4 border-t border-border/70 pt-4">
            <SheetLineChart
        title="Throughput"
        description="TOKENS"
        data={usagePlaceholderData}
        stroke="hsl(var(--chart-1))"
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
