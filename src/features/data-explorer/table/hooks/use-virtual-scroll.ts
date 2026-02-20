import * as React from "react";
import type { ColumnFiltersState, Row, SortingState } from "@tanstack/react-table";
import { useVirtualizer, type Virtualizer } from "@tanstack/react-virtual";
import type { FetchNextPageOptions } from "@tanstack/react-query";

const ESTIMATED_ROW_HEIGHT_PX = 41;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

function areColumnFiltersEqual(
  a: ColumnFiltersState,
  b: ColumnFiltersState,
) {
  if (a.length !== b.length) return false;
  return a.every((filter, index) => {
    const other = b[index];
    if (!other) return false;
    if (filter.id !== other.id) return false;
    return isLooseEqual(filter.value, other.value);
  });
}

function isLooseEqual(a: unknown, b: unknown) {
  if (Object.is(a, b)) return true;
  if (
    typeof a === "object" &&
    a !== null &&
    typeof b === "object" &&
    b !== null
  ) {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

export interface UseVirtualScrollOptions<TData> {
  rows: Row<TData>[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  isLoading?: boolean;
  isFetching?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  fetchNextPage: (options?: FetchNextPageOptions | undefined) => Promise<unknown>;
  dataLength: number;
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
}

export interface UseVirtualScrollReturn {
  containerHeight: number | null;
  derivedOverscan: number;
  overscan: number;
  isPrefetching: boolean;
  onScroll: (e: React.UIEvent<HTMLElement>) => void;
  virtualizationEnabled: boolean;
  virtualItems: ReturnType<ReturnType<typeof useVirtualizer>["getVirtualItems"]>;
  totalSize: number;
  measureVirtualRow: ((node: Element | null) => void) | undefined;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
}

export function useVirtualScroll<TData>({
  rows,
  containerRef,
  isLoading,
  isFetching,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
  dataLength,
  sorting,
  columnFilters,
}: UseVirtualScrollOptions<TData>): UseVirtualScrollReturn {
  const [containerHeight, setContainerHeight] = React.useState<number | null>(null);

  const derivedOverscan = React.useMemo(() => {
    if (containerHeight && Number.isFinite(containerHeight)) {
      const rowsInView = Math.max(
        1,
        Math.ceil(containerHeight / ESTIMATED_ROW_HEIGHT_PX),
      );
      // Slightly larger buffer to smooth Safari/table layouts
      return clamp(Math.ceil(rowsInView * 0.75), 6, 16);
    }
    // Fallback buffer when not yet measured
    return 10;
  }, [containerHeight]);

  // Container height measurement via ResizeObserver
  React.useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const height =
        container.getBoundingClientRect()?.height || container.offsetHeight;
      if (height) {
        setContainerHeight(height);
      }
    };

    measure();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        setContainerHeight(entry.contentRect.height);
      });
      observer.observe(container);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
    };
  }, [containerRef]);

  // Prefetch gating
  const [isPrefetching, setIsPrefetching] = React.useState(false);
  React.useEffect(() => {
    if (!isFetchingNextPage) {
      setIsPrefetching(false);
    }
  }, [isFetchingNextPage]);

  const requestNextPage = React.useCallback(() => {
    if (isPrefetching || isFetching || isFetchingNextPage || !hasNextPage) {
      return;
    }
    setIsPrefetching(true);
    void fetchNextPage().finally(() => {
      setIsPrefetching(false);
    });
  }, [fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, isPrefetching]);

  const onScroll = React.useCallback(
    (e: React.UIEvent<HTMLElement>) => {
      const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
      const distanceToBottom = scrollHeight - (scrollTop + clientHeight);
      const threshold = containerHeight
        ? Math.max(containerHeight * 0.5, ESTIMATED_ROW_HEIGHT_PX * derivedOverscan)
        : 600;
      if (distanceToBottom <= threshold) {
        requestNextPage();
      }
    },
    [requestNextPage, containerHeight, derivedOverscan],
  );

  const overscan = React.useMemo(() => {
    if (!rows.length) return derivedOverscan;
    return Math.min(Math.max(1, derivedOverscan), rows.length);
  }, [rows.length, derivedOverscan]);

  // Scroll-to-top on sorting/filter changes
  const previousFiltersRef = React.useRef<ColumnFiltersState | null>(null);
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTop = 0;
  }, [sorting, containerRef]);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (
      previousFiltersRef.current &&
      areColumnFiltersEqual(previousFiltersRef.current, columnFilters ?? [])
    ) {
      return;
    }
    previousFiltersRef.current = columnFilters;
    container.scrollTop = 0;
  }, [columnFilters, containerRef]);

  // Virtual scrolling setup
  const virtualizationEnabled =
    !isLoading && !(isFetching && !dataLength) && rows.length > 0;

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT_PX,
    overscan,
    enabled: virtualizationEnabled,
  });

  const measureVirtualRow = virtualizationEnabled
    ? rowVirtualizer.measureElement
    : undefined;

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  return {
    containerHeight,
    derivedOverscan,
    overscan,
    isPrefetching,
    onScroll,
    virtualizationEnabled,
    virtualItems,
    totalSize,
    measureVirtualRow,
    rowVirtualizer,
  };
}

export { ESTIMATED_ROW_HEIGHT_PX };
