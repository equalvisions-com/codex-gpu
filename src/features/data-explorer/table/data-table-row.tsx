"use client";

import {
  TableCell,
  TableRow,
} from "@/components/custom/table";
import { cn } from "@/lib/utils";
import * as React from "react";
import type {
  Row,
  Table as TTable,
} from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";

/**
 * REMINDER: this is the heaviest component in the table if lots of rows
 * Some other components are rendered more often necessary, but are fixed size (not like rows that can grow in height)
 * e.g. DataTableFilterControls, DataTableFilterCommand, DataTableToolbar, DataTableHeader
 */

function RowComponent<TData>({
  row,
  table,
  selected,
  checked,
  "data-index": dataIndex,
  ref: measureRef,
  getModelColumnWidth,
  primaryColumnId,
}: {
  row: Row<TData>;
  table: TTable<TData>;
  // REMINDER: row.getIsSelected(); - just for memoization
  selected?: boolean;
  // Memoize checked highlight without forcing full row rerender otherwise
  checked?: boolean;
  "data-index"?: number;
  ref?: React.Ref<HTMLTableRowElement>;
  getModelColumnWidth?: (columnId: string, currentSize: number) => string;
  primaryColumnId?: string;
}) {
  const canHover =
    typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches
      ? true
      : undefined;

  const columnMeta = React.useMemo(() => {
    if (!primaryColumnId) return null;
    const column = table.getColumn(primaryColumnId);
    if (!column) return null;
    return {
      minSize: column.columnDef.minSize ?? 275,
      size: column.columnDef.size ?? 275,
    };
  }, [primaryColumnId, table]);
  const minimumModelColumnWidth = columnMeta?.minSize ?? 275;

  return (
    <TableRow
      ref={measureRef}
      id={row.id}
      data-can-hover={canHover}
      data-index={dataIndex}
      tabIndex={0}
      data-state={selected && "selected"}
      aria-selected={row.getIsSelected()}
      data-checked={checked ? "checked" : undefined}
      onClick={() => row.toggleSelected()}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          row.toggleSelected();
        }
      }}
      className={cn(
        "group/model-row relative",
        "bg-background border-b transition-colors focus-visible:bg-muted hover:cursor-pointer",
        canHover && "data-[can-hover=true]:hover:bg-muted data-[state=selected]:bg-muted data-[checked=checked]:bg-muted",
        !canHover && selected && "bg-muted",
        !canHover && checked && "bg-muted",
        table.options.meta?.getRowClassName?.(row),
      )}
    >
      {row.getVisibleCells().map((cell) => {
        const isCheckboxCell = cell.column.id === "blank";
        const stopPropagation = (e: React.SyntheticEvent) => {
          e.stopPropagation();
        };
        const isModelColumn = primaryColumnId
          ? cell.column.id === primaryColumnId
          : false;
        return (
          <TableCell
            key={cell.id}
            data-column-id={cell.column.id}
            onClick={isCheckboxCell ? stopPropagation : undefined}
            onMouseDown={isCheckboxCell ? stopPropagation : undefined}
            onPointerDown={isCheckboxCell ? stopPropagation : undefined}
            onKeyDown={isCheckboxCell ? stopPropagation : undefined}
            className={cn(
              "truncate border-b border-border px-[12px] py-[10px] transition-colors",
              isCheckboxCell && "cursor-default hover:cursor-default",
              cell.column.columnDef.meta?.cellClassName,
            )}
            style={{
              width: getModelColumnWidth
                ? getModelColumnWidth(cell.column.id, cell.column.getSize())
                : `${cell.column.getSize()}px`,
              minWidth:
                isModelColumn
                  ? `${minimumModelColumnWidth}px`
                  : cell.column.columnDef.minSize,
            }}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        );
      })}
    </TableRow>
  );
}

export const MemoizedRow = React.memo(
  RowComponent,
  (prev, next) =>
    prev.row.id === next.row.id &&
    Object.is(prev.row.original, next.row.original) &&
    prev.selected === next.selected &&
    prev.checked === next.checked &&
    prev["data-index"] === next["data-index"] &&
    prev.getModelColumnWidth === next.getModelColumnWidth,
) as typeof RowComponent;
