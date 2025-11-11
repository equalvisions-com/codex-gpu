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
import { MemoizedDataTableSheetContent } from "@/components/data-table/data-table-sheet/data-table-sheet-content";
import { filterFields, sheetFields } from "./models-constants";
import type { ModelsColumnSchema } from "./models-schema";
import { useQueries } from "@tanstack/react-query";
import { SheetLineChart } from "@/components/charts/sheet-line-chart";

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
      <DialogContent className="max-w-3xl bg-background">
        <DialogHeader>
          <DialogTitle>Compare models</DialogTitle>
          <DialogDescription>
            Side-by-side details for the selected models.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-2">
          {rows.map((row, index) => {
            const data = row.original as ModelsColumnSchema;
            return (
              <div
                key={row.id ?? `model-compare-${index}`}
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
              Select another model to compare side by side.
            </div>
          ) : null}
          <div className="md:col-span-2 space-y-4">
            <ModelComparisonCharts rows={rows} dialogOpen={open} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type TimeseriesPoint = { observedAt: string };

type ThroughputApiResponse = {
  series: {
    data: (TimeseriesPoint & { throughput: number })[];
  }[];
};

type LatencyApiResponse = {
  series: {
    data: (TimeseriesPoint & { latency: number })[];
  }[];
};

async function fetchThroughput(permaslug: string, endpointId: string) {
  const params = new URLSearchParams({ permaslug, endpointId, refresh: "1" });
  const res = await fetch(`/api/models/throughput?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to load throughput (${res.status})`);
  }
  return (await res.json()) as ThroughputApiResponse;
}

async function fetchLatency(permaslug: string, endpointId: string) {
  const params = new URLSearchParams({ permaslug, endpointId, refresh: "1" });
  const res = await fetch(`/api/models/latency?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to load latency (${res.status})`);
  }
  return (await res.json()) as LatencyApiResponse;
}

function ModelComparisonCharts({
  rows,
  dialogOpen,
}: {
  rows: Row<ModelsColumnSchema>[];
  dialogOpen: boolean;
}) {
  const targets = React.useMemo(() => {
    return rows
      .map((row, index) => {
        const data = row.original as ModelsColumnSchema;
        if (!data.permaslug || !data.endpointId) return null;
        return {
          key: `${data.permaslug}:${data.endpointId}`,
          permaslug: data.permaslug,
          endpointId: data.endpointId,
          label: data.shortName ?? data.name ?? data.permaslug,
          color: `hsl(var(--chart-${(index % 5) + 1}))`,
        };
      })
      .filter((target): target is NonNullable<typeof target> => Boolean(target));
  }, [rows]);

  const throughputQueries = useQueries({
    queries: targets.map((target) => ({
      queryKey: ["model-throughput", target.permaslug, target.endpointId],
      enabled: dialogOpen,
      staleTime: 1000 * 60 * 15,
      refetchOnWindowFocus: false,
      queryFn: () => fetchThroughput(target.permaslug, target.endpointId),
    })),
  });

  const latencyQueries = useQueries({
    queries: targets.map((target) => ({
      queryKey: ["model-latency", target.permaslug, target.endpointId],
      enabled: dialogOpen,
      staleTime: 1000 * 60 * 15,
      refetchOnWindowFocus: false,
      queryFn: () => fetchLatency(target.permaslug, target.endpointId),
    })),
  });

  const throughputSeries = React.useMemo(() => {
    return targets.map((target, index) => {
      const query = throughputQueries[index];
      const series = query?.data?.series?.[0];
      const points = series?.data ?? [];
      return {
        id: `throughput-${target.key}`,
        label: target.label,
        color: target.color,
        data: points.map((point) => ({
          value: point.throughput,
          observedAt: point.observedAt,
        })),
      };
    });
  }, [targets, throughputQueries]);

  const latencySeries = React.useMemo(() => {
    return targets.map((target, index) => {
      const query = latencyQueries[index];
      const series = query?.data?.series?.[0];
      const points = series?.data ?? [];
      return {
        id: `latency-${target.key}`,
        label: target.label,
        color: target.color,
        data: points.map((point) => ({
          value: point.latency / 1000,
          observedAt: point.observedAt,
        })),
      };
    });
  }, [targets, latencyQueries]);

  const throughputLoading = throughputQueries.some(
    (query) => query.isPending || query.isFetching,
  );
  const latencyLoading = latencyQueries.some(
    (query) => query.isPending || query.isFetching,
  );
  const throughputError = throughputQueries.some((query) => query.isError);
  const latencyError = latencyQueries.some((query) => query.isError);

  const throughputEmptyMessage = !targets.length
    ? "Select models with provider variants to compare throughput."
    : throughputError
      ? "Unable to load throughput data."
      : "No throughput samples yet.";

  const latencyEmptyMessage = !targets.length
    ? "Select models with provider variants to compare latency."
    : latencyError
      ? "Unable to load latency data."
      : "No latency samples yet.";

  const latencyValueFormatter = React.useCallback((value: number) => {
    return value >= 1 ? value.toFixed(2) : value.toFixed(3);
  }, []);

  const hasTargets = targets.length > 0;

  return (
    <div className="space-y-4">
      <SheetLineChart
        title="Throughput"
        description={
          hasTargets ? `Comparing ${targets.length} ${targets.length === 1 ? "model" : "models"}` : undefined
        }
        series={throughputSeries}
        isLoading={throughputLoading}
        emptyMessage={throughputEmptyMessage}
        valueLabel="tok/s"
      />
      <SheetLineChart
        title="Latency"
        description={
          hasTargets ? `Comparing ${targets.length} ${targets.length === 1 ? "model" : "models"}` : undefined
        }
        series={latencySeries}
        isLoading={latencyLoading}
        emptyMessage={latencyEmptyMessage}
        valueFormatter={latencyValueFormatter}
        valueLabel="seconds"
      />
    </div>
  );
}
