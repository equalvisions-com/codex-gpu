import * as React from "react";
import type { Column, Table as TTable } from "@tanstack/react-table";

export interface UseColumnResizeOptions<TData> {
  table: TTable<TData>;
  primaryColumnId: string;
  primaryColumn: Column<TData, unknown> | undefined;
}

export interface UseColumnResizeReturn {
  /** Stable ref map accessor - get or create a ref for a specific header ID */
  getHeaderRef: (headerId: string) => React.RefObject<HTMLTableCellElement | null>;
  /** Model column measured width ref (used in resize start handler) */
  modelColumnMeasuredWidthRef: React.RefObject<number | null>;
  /** Whether model column has been manually resized */
  modelColumnHasBeenResizedRef: React.RefObject<boolean>;
  /** Whether a model column resize is currently pending */
  pendingModelColumnResizeRef: React.RefObject<boolean>;
  /** Minimum width for the model/primary column */
  minimumModelColumnWidth: number;
  /** Default size for the model/primary column */
  modelColumnDefaultSize: number;
  /** Get the width style for any column (returns "auto" or px value) */
  getModelColumnWidth: (columnId: string, currentSize: number) => string;
  /** Total width of all non-primary (fixed) columns */
  fixedColumnsWidth: number;
}

export function useColumnResize<TData>({
  table,
  primaryColumnId,
  primaryColumn,
}: UseColumnResizeOptions<TData>): UseColumnResizeReturn {
  const columnSizing = table.getState().columnSizing;
  const visibleLeafColumns = table.getVisibleLeafColumns();
  // Stable key for column sizing - only changes when actual sizes change (not on every render)
  const columnSizingKey = JSON.stringify(columnSizing);

  // Track measured width for reference
  const modelColumnMeasuredWidthRef = React.useRef<number | null>(null);
  // Track if model column has been manually resized - persists across renders
  // Once resized, column should always use pixel width (never revert to "auto")
  const modelColumnHasBeenResizedRef = React.useRef<boolean>(false);
  const pendingModelColumnResizeRef = React.useRef<boolean>(false);

  // Stable ref map for header elements - created once, persists across renders
  const headerRefsMap = React.useRef<Map<string, React.RefObject<HTMLTableCellElement | null>>>(new Map());

  // Get or create a ref for a specific header ID
  const getHeaderRef = React.useCallback((headerId: string): React.RefObject<HTMLTableCellElement | null> => {
    if (!headerRefsMap.current.has(headerId)) {
      headerRefsMap.current.set(headerId, React.createRef<HTMLTableCellElement | null>());
    }
    return headerRefsMap.current.get(headerId)!;
  }, []);

  // ResizeObserver for measuring the primary column header
  React.useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const headerElement = primaryColumnId
      ? getHeaderRef(primaryColumnId).current
      : null;
    if (!headerElement) {
      return;
    }

    const updateMeasuredWidth = (width?: number) => {
      if (!width || Number.isNaN(width)) {
        return;
      }
      modelColumnMeasuredWidthRef.current = width;
    };

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        updateMeasuredWidth(entry.contentRect.width);
      });
      observer.observe(headerElement);
      return () => observer.disconnect();
    }

    let frame: number | null = null;
    let pending = false;
    const handleResize = () => {
      if (pending) return;
      pending = true;
      frame = window.requestAnimationFrame(() => {
        pending = false;
        updateMeasuredWidth(
          headerElement.offsetWidth ||
          headerElement.getBoundingClientRect().width,
        );
      });
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (frame) {
        cancelAnimationFrame(frame);
      }
    };
  }, [getHeaderRef, primaryColumnId]);

  const minimumModelColumnWidth = React.useMemo(
    () => primaryColumn?.columnDef.minSize ?? 275,
    [primaryColumn],
  );
  const modelColumnDefaultSize = React.useMemo(
    () => primaryColumn?.columnDef.size ?? 275,
    [primaryColumn],
  );

  // Helper to get model column width style
  const getModelColumnWidth = React.useCallback((columnId: string, currentSize: number) => {
    if (!primaryColumnId || columnId !== primaryColumnId || !primaryColumn) {
      return `${currentSize}px`;
    }

    // Once resized, always use pixel width (prevents jumping when hitting min size)
    if (modelColumnHasBeenResizedRef.current) {
      return `${currentSize}px`;
    }

    // Use "auto" for flex growth only when never resized and at default size
    return currentSize === modelColumnDefaultSize ? "auto" : `${currentSize}px`;
  }, [modelColumnDefaultSize, primaryColumn, primaryColumnId]);

  const fixedColumnsWidth = React.useMemo(
    () =>
      visibleLeafColumns
        .filter((column) => column.id !== primaryColumnId)
        .reduce((acc, column) => acc + column.getSize(), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- columnSizingKey is a stable string derived from columnSizing
    [primaryColumnId, visibleLeafColumns, columnSizingKey],
  );

  return {
    getHeaderRef,
    modelColumnMeasuredWidthRef,
    modelColumnHasBeenResizedRef,
    pendingModelColumnResizeRef,
    minimumModelColumnWidth,
    modelColumnDefaultSize,
    getModelColumnWidth,
    fixedColumnsWidth,
  };
}
