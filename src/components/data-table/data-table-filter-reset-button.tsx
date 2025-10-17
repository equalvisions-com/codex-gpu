"use client";

import type { DataTableFilterField } from "./types";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useDataTable } from "@/components/data-table/data-table-provider";

export function DataTableFilterResetButton<TData>({
  value: _value,
}: DataTableFilterField<TData>) {
  const { columnFilters, table, setColumnFilters } = useDataTable();
  const value = _value as string;
  const filterValue = columnFilters.find((f) => f.id === value)?.value;

  // TODO: check if we could useMemo
  // For range filters (arrays with exactly 2 numbers), count as 1 filter
  // For multi-select filters (arrays with different structure), count array length
  const filters = (() => {
    if (!filterValue) return [];

    if (
      typeof filterValue === "object" &&
      !Array.isArray(filterValue) &&
      "values" in (filterValue as any) &&
      Array.isArray((filterValue as any).values)
    ) {
      return (filterValue as { values: unknown[] }).values ?? [];
    }

    if (
      Array.isArray(filterValue) &&
      filterValue.length === 2 &&
      typeof filterValue[0] === "number" &&
      typeof filterValue[1] === "number"
    ) {
      return [filterValue];
    }

    if (Array.isArray(filterValue)) {
      return filterValue;
    }

    return [filterValue];
  })();

  if (filters.length === 0) return null;

  return (
    <Button
      variant="outline"
      className="h-5 rounded-full px-1.5 py-1 font-mono text-[10px]"
      onClick={(e) => {
        e.stopPropagation();
        const newFilters = columnFilters.filter(f => f.id !== value);
        setColumnFilters(newFilters);
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.code === "Enter") {
          const newFilters = columnFilters.filter(f => f.id !== value);
          setColumnFilters(newFilters);
        }
      }}
      asChild
    >
      {/* REMINDER: `AccordionTrigger` is also a button(!) and we get Hydration error when rendering button within button */}
      <div role="button" tabIndex={0}>
        <span>{filters.length}</span>
        <X className="ml-1 h-2.5 w-2.5 text-muted-foreground" />
      </div>
    </Button>
  );
}
