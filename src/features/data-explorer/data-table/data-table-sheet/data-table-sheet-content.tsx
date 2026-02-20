"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Table } from "@tanstack/react-table";
import { DataTableSheetRowAction } from "./data-table-sheet-row-action";
import { DataTableFilterField, SheetField } from "../types";
import { SheetDetailsContentSkeleton } from "./data-table-sheet-skeleton";

interface DataTableSheetContentProps<TData, TMeta>
  extends React.HTMLAttributes<HTMLDListElement> {
  data?: TData;
  table: Table<TData>;
  fields: SheetField<TData, TMeta>[];
  filterFields: DataTableFilterField<TData>[];
  // totalRows: number;
  // filterRows: number;
  // totalRowsFetched: number;
  metadata?: TMeta;
}

function DataTableSheetContent<TData, TMeta>({
  data,
  table,
  className,
  fields,
  filterFields,
  metadata,
  ...props
}: DataTableSheetContentProps<TData, TMeta>) {
  if (!data) return <SheetDetailsContentSkeleton fields={fields} />;

  // Build a map of previous *visible* fields (respecting conditions) for divider logic
  const prevVisibleMap = new Map<number, (typeof fields)[number] | null>();
  let lastVisibleField: (typeof fields)[number] | null = null;
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    const isVisible = !f.condition || f.condition(data);
    prevVisibleMap.set(i, lastVisibleField);
    if (isVisible) {
      lastVisibleField = f;
    }
  }

  return (
    <dl className={cn(className)} {...props}>
      {fields.map((field, fieldIndex) => {
        if (field.condition && !field.condition(data)) return null;

        const Component = field.component;
        const value = String(data[field.id]);
        const previousVisibleField = prevVisibleMap.get(fieldIndex) ?? null;
        const shouldAddDivider =
          previousVisibleField !== null &&
          !(
            previousVisibleField.hideLabel &&
            field.hideLabel &&
            previousVisibleField.fullRowValue &&
            field.fullRowValue
          );

        const showLabel = !field.hideLabel;
        const containerClasses = cn(
          "flex items-start gap-4 text-sm w-full",
          field.noPadding ? "py-0" : "py-2",
          field.fullRowValue || !showLabel ? "justify-start" : "justify-between",
          shouldAddDivider && "border-t border-border/60",
          field.className,
        );
        const valueClasses = cn(
          "flex w-full min-w-0 items-center font-mono",
          field.fullRowValue || !showLabel
            ? "justify-start text-left"
            : "justify-end text-right",
        );

        return (
          <div key={field.id.toString()}>
            {field.type === "readonly" ? (
              <div className={containerClasses}>
                {showLabel ? (
                  <dt className="flex shrink-0 items-start text-foreground/70">
                    {field.label}
                  </dt>
                ) : null}
                <dd className={valueClasses}>
                  {field.truncate ? (
                    <span className="truncate block w-full">
                      {Component ? (
                        <Component {...data} metadata={metadata} />
                      ) : (
                        value
                      )}
                    </span>
                  ) : (
                    Component ? (
                      <Component {...data} metadata={metadata} />
                    ) : (
                      value
                    )
                  )}
                </dd>
              </div>
            ) : (
              <DataTableSheetRowAction
                fieldValue={field.id}
                filterFields={filterFields}
                value={value}
                table={table}
                className={containerClasses}
              >
                {showLabel ? (
                  <dt className="flex shrink-0 items-start text-foreground/70">
                    {field.label}
                  </dt>
                ) : null}
                <dd className={valueClasses}>
                  {Component ? (
                    <Component {...data} metadata={metadata} />
                  ) : (
                    value
                  )}
                </dd>
              </DataTableSheetRowAction>
            )}
          </div>
        );
      })}
    </dl>
  );
}

export const MemoizedDataTableSheetContent = React.memo(
  DataTableSheetContent,
  (prev, next) => {
    // REMINDER: only check if data is the same, rest is useless
    return prev.data === next.data;
  }
) as typeof DataTableSheetContent;
