import * as React from "react";
import { cn } from "@/lib/utils";

export type ChartLegendItem = {
  id?: string;
  label: string;
  provider?: string | null;
  color?: string;
};

interface ChartLegendProps {
  items: ChartLegendItem[];
  className?: string;
  layout?: "stacked" | "wrap";
}

export function ChartLegend({ items, className, layout = "wrap" }: ChartLegendProps) {
  if (!items.length) return null;

  const baseClasses =
    layout === "stacked"
      ? "flex flex-col gap-1.5 text-xs text-foreground/80"
      : "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/80";

  return (
    <div className={cn(baseClasses, className)}>
      {items.map((item) => (
        <div key={item.id ?? item.label} className="flex items-center gap-1.5 leading-tight">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: item.color ?? "hsl(var(--foreground))" }}
          />
          <span className="font-medium text-foreground">{item.label}</span>
          {item.provider ? (
            <span className="text-foreground/70">({item.provider})</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
