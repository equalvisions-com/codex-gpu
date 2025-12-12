"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MemoizedDataTableSheetContent } from "@/features/data-explorer/data-table/data-table-sheet/data-table-sheet-content";
import type { Row, Table as TanStackTable } from "@tanstack/react-table";
import type { ToolColumnSchema } from "./tools-schema";
import { filterFields, sheetFields } from "./tools-constants";

interface ToolsCompareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: Row<ToolColumnSchema>[];
  table: TanStackTable<ToolColumnSchema>;
}

export function ToolsCompareDialog({
  open,
  onOpenChange,
  rows,
  table,
}: ToolsCompareDialogProps) {
  if (!rows.length) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-background p-4 sm:p-4 border border-border/60 [&>button:last-of-type]:right-4 [&>button:last-of-type]:top-4">
        <DialogHeader>
          <DialogTitle>Tool Comparison</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((row, index) => {
            const data = row.original as ToolColumnSchema;
            return (
              <div
                key={row.id ?? `compare-${index}`}
                className="rounded-xl border border-border/60 bg-background/80 px-4 pt-4 pb-2 space-y-4"
              >
                <MemoizedDataTableSheetContent
                  table={table}
                  data={data}
                  filterFields={filterFields}
                  fields={sheetFields}
                  metadata={{
                    titleClassName: "text-base font-semibold leading-none tracking-tight mb-1",
                  }}
                />
              </div>
            );
          })}
          {rows.length === 1 ? (
            <div className="hidden md:flex items-center justify-center rounded-xl border border-dashed border-border/60 text-sm text-muted-foreground">
              Select another row to compare side by side.
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
