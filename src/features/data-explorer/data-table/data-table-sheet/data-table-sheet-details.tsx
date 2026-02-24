"use client";

import { ChevronDown, ChevronUp, Info, X } from "lucide-react";
import * as React from "react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/custom/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useDataTable } from "@/features/data-explorer/data-table/data-table-provider";
import { Skeleton } from "@/components/ui/skeleton";

interface DataTableSheetDetailsProps {
  title?: React.ReactNode;
  titleClassName?: string;
  children?: React.ReactNode;
  getRowHref?: (row: Record<string, unknown>) => string | null;
}

export function DataTableSheetDetails({
  title,
  titleClassName,
  children,
  getRowHref,
}: DataTableSheetDetailsProps) {
  const { table, rowSelection, isLoading } = useDataTable();

  const selectedRowKey = Object.keys(rowSelection)?.[0];

  const selectedRow = React.useMemo(() => {
    if (isLoading && !selectedRowKey) return;
    return table
      .getCoreRowModel()
      .flatRows.find((row) => row.id === selectedRowKey);
  }, [selectedRowKey, isLoading, table]);

  const index = table
    .getCoreRowModel()
    .flatRows.findIndex((row) => row.id === selectedRow?.id);

  const nextId = React.useMemo(
    () => table.getCoreRowModel().flatRows[index + 1]?.id,
    [index, table],
  );

  const prevId = React.useMemo(
    () => table.getCoreRowModel().flatRows[index - 1]?.id,
    [index, table],
  );

  const selectedRowData = selectedRow?.original as Record<string, unknown> | undefined;
  const href = React.useMemo(() => {
    if (!selectedRowData || !getRowHref) return null;
    return getRowHref(selectedRowData);
  }, [selectedRowData, getRowHref]);

  const onPrev = React.useCallback(() => {
    if (prevId) table.setRowSelection({ [prevId]: true });
  }, [prevId, table]);

  const onNext = React.useCallback(() => {
    if (nextId) table.setRowSelection({ [nextId]: true });
  }, [nextId, table]);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!selectedRowKey) return;

      // REMINDER: prevent dropdown navigation inside of sheet to change row selection
      const activeElement = document.activeElement;
      const isMenuActive = activeElement?.closest('[role="menu"]');

      if (isMenuActive) return;

      if (e.key === "ArrowUp") {
        e.preventDefault();
        onPrev();
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        onNext();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        // Close the sheet and return focus to the selected row
        const el = selectedRowKey ? document.getElementById(selectedRowKey) : null;
        table.resetRowSelection();
        setTimeout(() => el?.focus(), 0);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [selectedRowKey, onNext, onPrev, table]);

  return (
    <Sheet
      open={!!selectedRowKey}
      onOpenChange={() => {
        // REMINDER: focus back to the row that was selected
        // We need to manually focus back due to missing Trigger component
        const el = selectedRowKey
          ? document.getElementById(selectedRowKey)
          : null;
        table.resetRowSelection();

        // REMINDER: when navigating between tabs in the sheet and exit the sheet, the tab gets lost
        // We need a minimal delay to allow the sheet to close before focusing back to the row
        setTimeout(() => el?.focus(), 0);
      }}
    >
      <SheetContent
        // onCloseAutoFocus={(e) => e.preventDefault()}
        className="flex h-full flex-col overflow-hidden p-0 sm:max-w-md gap-0"
        hideClose
      >
        <SheetHeader className="sr-only">
          <SheetTitle className={cn(titleClassName)}>
            {isLoading && !selectedRowKey ? (
              <Skeleton className="h-6 w-32" />
            ) : (
              title
            )}
          </SheetTitle>
        </SheetHeader>
        <SheetDescription className="sr-only">
          Selected row details
        </SheetDescription>
        <div className="flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mb-[10px] flex h-6 items-center justify-end gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              disabled={!prevId}
              onClick={onPrev}
              aria-label="Previous (↑)"
              title="Previous (↑)"
            >
              <ChevronUp className="h-5 w-5 text-accent-foreground" />
              <span className="sr-only">Previous</span>
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              disabled={!nextId}
              onClick={onNext}
              aria-label="Next (↓)"
              title="Next (↓)"
            >
              <ChevronDown className="h-5 w-5 text-accent-foreground" />
              <span className="sr-only">Next</span>
            </Button>
            <Separator orientation="vertical" className="mx-1" />
            <SheetClose autoFocus={true} asChild>
              <Button size="icon" variant="ghost" className="h-6 w-6">
                <X className="h-5 w-5 text-accent-foreground" />
                <span className="sr-only">Close</span>
              </Button>
            </SheetClose>
          </div>
          <div className="space-y-4">{children}</div>
          <div className="pt-4">
            {href ? (
              <Button asChild className="w-full font-semibold">
                <a href={href} target="_blank" rel="noopener noreferrer" title="This link may be an affiliate link" className="inline-flex items-center justify-center gap-2">
                  Learn More
                  <Info className="h-4 w-4" />
                </a>
              </Button>
            ) : (
              <Button
                className="w-full font-semibold"
                type="button"
                disabled
              >
                <span className="inline-flex items-center gap-2">
                  Learn More
                  <Info className="h-4 w-4" />
                </span>
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
