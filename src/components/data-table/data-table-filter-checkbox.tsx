"use client";
import { useDataTable } from "@/components/data-table/data-table-provider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { CheckboxListSkeleton } from "./data-table-filter-skeletons";

import type { DataTableCheckboxFilterField } from "./types";

export function DataTableFilterCheckbox<TData>({
  value: _value,
  options,
  component,
  skeletonRows,
}: DataTableCheckboxFilterField<TData>) {
  const value = _value as string;
  const { table, columnFilters, isLoading, getFacetedUniqueValues, setColumnFilters } =
    useDataTable();
  // REMINDER: avoid using column?.getFilterValue()
  const filterValue = columnFilters.find((i) => i.id === value)?.value;
  const facetedValue = getFacetedUniqueValues?.(table, value);

  const Component = component;
  const staticOptions = Array.isArray(options) ? options : undefined;
  const facetsReady = staticOptions !== undefined || facetedValue !== undefined;

  if (!facetsReady) {
    return <CheckboxListSkeleton rows={skeletonRows} />;
  }

  const filterOptions =
    staticOptions ??
    Array.from(facetedValue?.keys() ?? []).map((value) => ({
      label: String(value),
      value: String(value),
    }));

  // CHECK: it could be filterValue or searchValue
  const filters = filterValue
    ? Array.isArray(filterValue)
      ? filterValue
      : [filterValue]
    : [];

  if (isLoading && !filterOptions?.length) {
    return <CheckboxListSkeleton rows={skeletonRows} />;
  }

  return (
    <div className="grid gap-2">
      <ScrollArea className="max-h-[149px]">
        <div className="space-y-1">
          {filterOptions
            // TODO: we shoudn't sort the options here, instead filterOptions should be sorted by default
            // .sort((a, b) => a.label.localeCompare(b.label))
            ?.map((option, index) => {
              const checked = filters.includes(option.value);
              const shouldCapitalizeModalities =
                value === "inputModalities" || value === "outputModalities" || value === "modalities";
              const displayLabel = shouldCapitalizeModalities
                ? (() => {
                    const label = String(option.label);
                    return label.charAt(0).toUpperCase() + label.slice(1);
                  })()
                : option.label;

              return (
                <div
                  key={String(option.value)}
                  className={cn(
                    "group relative flex w-full items-center gap-2 px-2 py-1.5 cursor-pointer rounded-md",
                    checked
                      ? "border border-border bg-gradient-to-b from-muted/70 via-muted/40 to-background text-accent-foreground"
                      : "border border-transparent hover:border-border hover:bg-gradient-to-b hover:from-muted/70 hover:via-muted/40 hover:to-background hover:text-accent-foreground",
                  )}
                  onClick={() => {
                    const newValue = checked
                      ? filters?.filter((value) => option.value !== value)
                      : [...(filters || []), option.value];
                    const newFilters = columnFilters.map(f =>
                      f.id === value
                        ? { ...f, value: newValue?.length ? newValue : undefined }
                        : f
                    );
                    if (!columnFilters.find(f => f.id === value)) {
                      newFilters.push({ id: value, value: newValue?.length ? newValue : undefined });
                    }
                    setColumnFilters(newFilters.filter(f => f.value !== undefined));
                  }}
                >
                  <div className="flex w-full items-center text-foreground/90 group-hover:text-accent-foreground/90">
                    {Component ? (
                      <Component {...option} />
                    ) : (
                      <span className="block w-full truncate font-normal">{displayLabel}</span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </ScrollArea>
    </div>
  );
}
