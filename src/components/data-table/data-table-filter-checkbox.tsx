"use client";
import { useDataTable } from "@/components/data-table/data-table-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
 
import type { DataTableCheckboxFilterField } from "./types";

export function DataTableFilterCheckbox<TData>({
  value: _value,
  options,
  component,
}: DataTableCheckboxFilterField<TData>) {
  const value = _value as string;
  const { table, columnFilters, isLoading, getFacetedUniqueValues, setColumnFilters } =
    useDataTable();
  // REMINDER: avoid using column?.getFilterValue()
  const filterValue = columnFilters.find((i) => i.id === value)?.value;
  const facetedValue = getFacetedUniqueValues?.(table, value);

  const Component = component;

  // show all options without a search filter
  // If options are not provided, generate them from faceted values
  const filterOptions = options || (facetedValue ? Array.from(facetedValue.keys()).map((value) => ({
    label: String(value),
    value: String(value),
  })) : []);

  // CHECK: it could be filterValue or searchValue
  const filters = filterValue
    ? Array.isArray(filterValue)
      ? filterValue
      : [filterValue]
    : [];

  // REMINDER: if no options are defined, while fetching data, we should show a skeleton
  if (isLoading && !filterOptions?.length)
    return (
      <div className="grid divide-y rounded-lg border border-border">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-between gap-2 px-2 py-2.5"
          >
            <Skeleton className="h-4 w-4 rounded-sm" />
            <Skeleton className="h-4 w-full rounded-sm" />
          </div>
        ))}
      </div>
    );

  return (
    <div className="grid gap-2">
      {/* FIXME: due to the added max-h and overflow-y-auto, the hover state and border is laying on top of the scroll bar */}
      <div className="max-h-[200px] overflow-y-auto rounded-lg empty:border-none">
        {filterOptions
          // TODO: we shoudn't sort the options here, instead filterOptions should be sorted by default
          // .sort((a, b) => a.label.localeCompare(b.label))
          ?.map((option, index) => {
            const checked = filters.includes(option.value);

            return (
              <div
                key={String(option.value)}
                className={cn(
                  "group relative flex items-center px-2 py-2.5 hover:bg-accent/50 cursor-pointer",
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
                <div className="flex w-full items-center truncate text-foreground group-hover:text-accent-foreground">
                  {Component ? (
                    <Component {...option} />
                  ) : (
                    <span className="truncate font-normal">{option.label}</span>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
