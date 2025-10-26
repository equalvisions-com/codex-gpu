import { LEVELS } from "@/constants/levels";
import { REGIONS } from "@/constants/region";
import { isArrayOfDates, isArrayOfNumbers } from "@/lib/is-array";
import {
  calculatePercentile,
  calculateSpecificPercentile,
} from "@/lib/request/percentile";
import {
  differenceInMinutes,
  isSameDay,
} from "date-fns";
import type {
  ColumnSchema,
  FacetMetadataSchema,
} from "../schema";
import type { SearchParamsType } from "../search-params";

export const sliderFilterValues = [
  "vram_gb",
  "price_hour_usd",
] as const satisfies (keyof ColumnSchema)[];

export const filterValues = [
  "provider",
  "type",
  "gpu_model",
  ...sliderFilterValues,
  "observed_at",
] as const satisfies (keyof ColumnSchema)[];

export function filterData(
  data: ColumnSchema[],
  search: Partial<SearchParamsType>,
): ColumnSchema[] {
  const { start, size, sort, ...filters } = search;
  return data.filter((row) => {
    for (const key in filters) {
      const filter = filters[key as keyof typeof filters];
      if (filter === undefined || filter === null) continue;

      // Handle slider filters (vram_gb, price_hour_usd)
      if ((key === "vram_gb" || key === "price_hour_usd") && isArrayOfNumbers(filter)) {
        let value: number | undefined;
        switch (key) {
          case "vram_gb": {
            if (typeof row.vram_gb === "number") {
              value = row.vram_gb;
            } else if (typeof row.vram_gb === "string") {
              const parsed = Number(row.vram_gb);
              value = Number.isFinite(parsed) ? parsed : undefined;
            }
            break;
          }
          case "price_hour_usd": {
            if (typeof row.price_hour_usd === 'number') value = row.price_hour_usd;
            else if (typeof row.price_usd === 'number') value = row.price_usd;
            break;
          }
        }

        if (typeof value !== 'number' || !Number.isFinite(value)) continue;

        if (filter.length === 1 && value !== filter[0]) {
          return false;
        } else if (
          filter.length === 2 &&
          (value < filter[0] || value > filter[1])
        ) {
          return false;
        }
        continue;
      }

      // Handle observed_at date filtering
      if (key === "observed_at" && isArrayOfDates(filter)) {
        const value = new Date(row[key]);
        if (filter.length === 1 && !isSameDay(value, filter[0])) {
          return false;
        } else if (
          filter.length === 2 &&
          (value.getTime() < filter[0].getTime() ||
            value.getTime() > filter[1].getTime())
        ) {
          return false;
        }
        continue;
      }

      // Handle provider: allow array (checkbox union) or string (back-compat)
      if (key === "provider") {
        const value = row.provider;
        if (Array.isArray(filter)) {
          // union: any match passes
          const ok = filter.some((f) => String(value) === String(f));
          if (!ok) return false;
          continue;
        }
        if (typeof filter === 'string') {
          if (typeof value === 'string' && !value.toLowerCase().includes(filter.toLowerCase())) {
            return false;
          }
          continue;
        }
      }

      if (key === "type") {
        const value = row.type;
        if (Array.isArray(filter)) {
          const ok = filter.some((f) => String(value) === String(f));
          if (!ok) return false;
          continue;
        }
        if (typeof filter === "string") {
          if (
            typeof value === "string" &&
            !value.toLowerCase().includes(filter.toLowerCase())
          ) {
            return false;
          }
          continue;
        }
      }

      if (key === "gpu_model") {
        const rawValue = row.gpu_model ?? row.item;
        const value = typeof rawValue === "string" ? rawValue : undefined;
        if (Array.isArray(filter)) {
          if (filter.length) {
            const normalized = value?.toLowerCase().trim() ?? "";
            const match = filter.some((entry) => normalized === String(entry).toLowerCase().trim());
            if (!match) {
              return false;
            }
          }
          continue;
        }
        if (typeof filter === "string") {
          if (value && value.toLowerCase().includes(filter.toLowerCase())) {
            continue;
          }
          // If there is no match, reject row
          return false;
        }
        continue;
      }

      if (key === "search" && typeof filter === 'string') {
        const normalizedFilter = filter.toLowerCase().trim();
        if (!normalizedFilter.length) {
          continue;
        }

        const candidateText: Array<string> = [];

        const textFields: Array<unknown> = [
          row.gpu_model,
          row.item,
          row.provider,
          row.region,
          row.zone,
          row.sku,
          row.billing_notes,
          row.price_unit,
          row.type,
          row.network,
        ];

        const numericFields: Array<unknown> = [
          row.gpu_count,
          row.vram_gb,
          row.system_ram_gb,
          row.local_storage_tb,
          row.vcpus,
          row.price_hour_usd,
          row.price_month_usd,
          row.price_usd,
          row.raw_cost,
        ];

        for (const field of textFields) {
          if (typeof field === "string" && field.trim().length) {
            candidateText.push(field);
          }
        }

        for (const field of numericFields) {
          if (
            (typeof field === "number" && Number.isFinite(field)) ||
            typeof field === "string"
          ) {
            candidateText.push(String(field));
          }
        }

        const searchableText = candidateText
          .join(" ")
          .toLowerCase();

        if (!searchableText.includes(normalizedFilter)) {
          return false;
        }
        continue;
      }
    }
    return true;
  });
}

export function sortData(data: ColumnSchema[], sort: SearchParamsType["sort"]) {
  if (!sort) return data;

  const getComparableValue = (row: ColumnSchema, id: string): unknown => {
    switch (id) {
      // Canonical price used in UI: price_hour_usd || price_usd
      case "price_hour_usd": {
        return typeof row.price_hour_usd === "number"
          ? row.price_hour_usd
          : typeof row.price_usd === "number"
            ? row.price_usd
            : undefined;
      }
      // Canonical model used in UI: gpu_model || item
      case "gpu_model": {
        return row.gpu_model ?? row.item ?? undefined;
      }
      // Canonical RAM used in UI: system_ram_gb || parseFloat(ram_gb)
      case "system_ram_gb": {
        if (typeof row.system_ram_gb === "number") return row.system_ram_gb;
        const parsed = row.ram_gb ? parseFloat(String(row.ram_gb)) : NaN;
        return Number.isFinite(parsed) ? parsed : undefined;
      }
      // vcpus can be number or string; coerce to number for consistent sorting
      case "vcpus": {
        if (typeof row.vcpus === "number") return row.vcpus;
        const parsed = row.vcpus ? parseFloat(String(row.vcpus)) : NaN;
        return Number.isFinite(parsed) ? parsed : undefined;
      }
      default: {
        // Fallback to raw field with typed access
        return (row as Record<string, unknown>)[id as string];
      }
    }
  };

  const compareAsc = (aVal: unknown, bVal: unknown): number => {
    const aUndef = aVal === undefined || aVal === null;
    const bUndef = bVal === undefined || bVal === null;
    if (aUndef && bUndef) return 0;
    if (aUndef) return 1; // undefined/null go to bottom
    if (bUndef) return -1;

    if (typeof aVal === "number" && typeof bVal === "number") {
      return aVal === bVal ? 0 : aVal < bVal ? -1 : 1;
    }

    // string compare fallback
    const aStr = String(aVal);
    const bStr = String(bVal);
    return aStr.localeCompare(bStr);
  };

  const { id, desc } = sort;
  return data.sort((a, b) => {
    const aVal = getComparableValue(a, id);
    const bVal = getComparableValue(b, id);
    let cmp = compareAsc(aVal, bVal);

    // Deterministic tie-breaker to stabilize pagination windows
    if (cmp === 0) {
      // uuid is guaranteed in schema
      cmp = a.uuid === b.uuid ? 0 : a.uuid < b.uuid ? -1 : 1;
    }

    return desc ? -cmp : cmp;
  });
}

export function percentileData(data: ColumnSchema[]): ColumnSchema[] {
  // For GPU pricing, we can calculate percentiles based on price_hour_usd
  const rates = data.map((row) => row.price_hour_usd || 0);
  return data.map((row) => ({
    ...row,
    percentile: calculatePercentile(rates, row.price_hour_usd || 0),
  }));
}

export function splitData(data: ColumnSchema[], search: SearchParamsType) {
  // For pricing data, we don't need complex cursor-based pagination
  // Just return a slice of the data based on start and size
  const start = search.start || 0;
  const size = search.size || 50;

  return data.slice(start, start + size);
}

export function getFacetsFromData(data: ColumnSchema[]) {
  const valuesMap = data.reduce((prev, curr) => {
    // Compute canonical facet values per key
    const entries: Array<[string, any]> = [];
    if (filterValues.includes('provider' as any)) entries.push(['provider', curr.provider]);
    if (filterValues.includes('type' as any)) entries.push(['type', curr.type]);
    if (filterValues.includes('gpu_model' as any)) entries.push(['gpu_model', curr.gpu_model ?? curr.item]);
    if (filterValues.includes('gpu_count' as any)) entries.push(['gpu_count', curr.gpu_count]);
    if (filterValues.includes('vram_gb' as any)) entries.push(['vram_gb', curr.vram_gb]);
    if (filterValues.includes('price_hour_usd' as any)) {
      const val = typeof curr.price_hour_usd === 'number' ? curr.price_hour_usd : curr.price_usd;
      entries.push(['price_hour_usd', val]);
    }
    if (filterValues.includes('observed_at' as any)) entries.push(['observed_at', curr.observed_at]);

    for (const [key, value] of entries) {
      if (!filterValues.includes(key as any)) continue;
      const _value = Array.isArray(value) ? value.toString() : value;
      const total = prev.get(key)?.get(_value) || 0;
      if (prev.has(key) && _value !== undefined && _value !== null && _value !== '') {
        prev.get(key)?.set(_value, total + 1);
      } else if (_value !== undefined && _value !== null && _value !== '') {
        prev.set(key, new Map([[_value, 1]]));
      }
    }
    return prev;
  }, new Map<string, Map<any, number>>());

  const facets = Object.fromEntries(
    Array.from(valuesMap.entries()).map(([key, valueMap]) => {
      let min: number | undefined;
      let max: number | undefined;
      const rows = Array.from(valueMap.entries()).map(([value, total]) => {
        if (typeof value === "number") {
          if (!min) min = value;
          else min = value < min ? value : min;
          if (!max) max = value;
          else max = value > max ? value : max;
        }
        return {
          value,
          total,
        };
      });
      const total = Array.from(valueMap.values()).reduce((a, b) => a + b, 0);
      return [key, { rows, total, min, max }];
    }),
  );

  return facets satisfies Record<string, FacetMetadataSchema>;
}

export function getPercentileFromData(data: ColumnSchema[]) {
  const prices = data.map((row) => row.price_hour_usd || 0);

  const p50 = calculateSpecificPercentile(prices, 50);
  const p75 = calculateSpecificPercentile(prices, 75);
  const p90 = calculateSpecificPercentile(prices, 90);
  const p95 = calculateSpecificPercentile(prices, 95);
  const p99 = calculateSpecificPercentile(prices, 99);

  return { p50, p75, p90, p95, p99 };
}
