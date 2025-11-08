"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { TooltipProps } from "recharts";
import { Tooltip as RechartsTooltip } from "recharts";

type ChartConfigEntry = {
  label?: React.ReactNode;
  color?: string;
};

export type ChartConfig = Record<string, ChartConfigEntry>;

type ChartContainerProps = React.HTMLAttributes<HTMLDivElement> & {
  config: ChartConfig;
};

const ChartConfigContext = React.createContext<ChartConfig | null>(null);

export function ChartContainer({
  config,
  className,
  style,
  children,
  ...props
}: ChartContainerProps) {
  const cssVars = React.useMemo(() => {
    const entries = Object.entries(config);
    const baseStyle: React.CSSProperties = {};
    entries.forEach(([key, value], index) => {
      const colorVar = `--color-${key}`;
      const fallback = `hsl(var(--chart-${(index % 5) + 1}))`;
      baseStyle[colorVar as keyof React.CSSProperties] = value.color ?? fallback;
    });
    return baseStyle;
  }, [config]);

  return (
    <ChartConfigContext.Provider value={config}>
      <div
        className={cn("h-full w-full", className)}
        style={{ ...cssVars, ...style }}
        {...props}
      >
        {children}
      </div>
    </ChartConfigContext.Provider>
  );
}

type ChartTooltipProps = React.ComponentProps<typeof RechartsTooltip>;

export function ChartTooltip({ content, ...props }: ChartTooltipProps) {
  return (
    <RechartsTooltip
      cursor={false}
      wrapperClassName="outline-none"
      content={content ?? <ChartTooltipContent />}
      {...props}
    />
  );
}

type ChartTooltipContentProps = TooltipProps<number, string> & {
  hideLabel?: boolean;
};

export function ChartTooltipContent({
  active,
  payload,
  label,
  hideLabel,
  className,
}: ChartTooltipContentProps) {
  const config = React.useContext(ChartConfigContext);

  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-md border bg-background/95 p-3 text-xs shadow-lg",
        className,
      )}
    >
      {!hideLabel ? (
        <div className="mb-2 font-semibold text-foreground">{label}</div>
      ) : null}
      <div className="space-y-1">
        {payload.map((item) => {
          const key = item.dataKey?.toString() ?? "";
          const entry = key ? config?.[key] : undefined;
          return (
            <div key={item.dataKey?.toString() ?? item.name} className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: item.color ?? "hsl(var(--foreground))" }}
              />
              <span className="text-muted-foreground">
                {entry?.label ?? item.name ?? key}
              </span>
              <span className="ml-auto font-mono text-foreground">
                {typeof item.value === "number"
                  ? item.value.toLocaleString()
                  : item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
