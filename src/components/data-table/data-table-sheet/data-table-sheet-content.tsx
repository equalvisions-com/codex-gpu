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
  metadata?: TMeta & {
    totalRows: number;
    filterRows: number;
    totalRowsFetched: number;
  };
}

export function DataTableSheetContent<TData, TMeta>({
  data,
  table,
  className,
  fields,
  filterFields,
  metadata,
  ...props
}: DataTableSheetContentProps<TData, TMeta>) {
  if (!data) return <SheetDetailsContentSkeleton fields={fields} />;

  return (
    <dl className={cn("divide-y", className)} {...props}>
      {fields.map((field) => {
        if (field.condition && !field.condition(data)) return null;

        const Component = field.component;
        const value = String(data[field.id]);

        return (
          <div key={field.id.toString()}>
            {field.type === "readonly" ? (
              <div
                className={cn(
                  "flex items-center gap-4 py-2 text-sm justify-between w-full",
                  field.className
                )}
              >
                <dt className="flex shrink-0 items-center text-foreground/70">
                  {field.label}
                </dt>
                <dd className="flex w-full items-center justify-end text-right font-mono">
                  {Component ? (
                    <Component {...data} metadata={metadata} />
                  ) : (
                    value
                  )}
                </dd>
              </div>
            ) : (
              <DataTableSheetRowAction
                fieldValue={field.id}
                filterFields={filterFields}
                value={value}
                table={table}
                className={cn(
                  "flex items-center gap-4 py-2 text-sm justify-between w-full",
                  field.className
                )}
              >
                <dt className="flex shrink-0 items-center text-foreground/70">
                  {field.label}
                </dt>
                <dd className="flex w-full items-center justify-end text-right font-mono">
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
