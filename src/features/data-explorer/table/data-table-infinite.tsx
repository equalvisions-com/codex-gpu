"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/custom/table";
import { Button } from "@/components/ui/button";
import { DataTableProvider } from "@/features/data-explorer/data-table/data-table-provider";
import { DataTableFilterControls } from "@/features/data-explorer/data-table/data-table-filter-controls";
import { DataTableFilterInput } from "@/features/data-explorer/data-table/data-table-filter-input";
import { MemoizedDataTableSheetContent } from "@/features/data-explorer/data-table/data-table-sheet/data-table-sheet-content";
import { DataTableSheetDetails } from "@/features/data-explorer/data-table/data-table-sheet/data-table-sheet-details";
import type {
  DataTableFilterField,
  SheetField,
  DataTableInputFilterField,
} from "@/features/data-explorer/data-table/types";
import { cn } from "@/lib/utils";
import { type FetchNextPageOptions } from "@tanstack/react-query";
import * as React from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  ColumnDef,
  ColumnFiltersState,
  Row,
  RowSelectionState,
  SortingState,
  TableOptions,
  Table as TTable,
  OnChangeFn,
} from "@tanstack/react-table";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { RowSkeletons } from "./_components/row-skeletons";
import { CheckedActionsIsland } from "./_components/checked-actions-island";
// Use next/dynamic with ssr: false for truly client-only lazy loading
// This prevents any SSR/prefetching and ensures components only load when sheet is opened
import dynamic from "next/dynamic";

const LazyGpuSheetCharts = dynamic(
  () => import("./gpu-sheet-charts").then((module) => ({
    default: module.GpuSheetCharts,
  })),
  {
    ssr: false, // Client-only - only loads when sheet is opened
  },
);
import { UserMenu, type AccountUser } from "./account-components";
import { usePathname, useRouter } from "next/navigation";
import { Bot, Search, Server, Wrench } from "lucide-react";
import type { FavoriteKey } from "@/types/favorites";
import { useGlobalHotkeys } from "@/hooks/use-global-hotkeys";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const noop = () => {};
const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);
const ESTIMATED_ROW_HEIGHT_PX = 41;

export type NavItem = {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  isCurrent?: boolean;
};

const DEFAULT_NAV_ITEMS: NavItem[] = [
  { label: "LLMs", value: "/llms", icon: Bot, shortcut: "k" },
  { label: "GPUs", value: "/gpus", icon: Server, shortcut: "g" },
  { label: "Tools", value: "/tools", icon: Wrench, shortcut: "e" },
];

// Note: chart groupings could be added later if needed
export type DataTableMeta<TMeta, TFavorite = FavoriteKey> = TMeta & {
  facets?: Record<string, any>;
  initialFavoriteKeys?: TFavorite[];
};

interface DataTableInfiniteProps<TData, TValue, TMeta, TFavorite> {
  columns: ColumnDef<TData, TValue>[];
  getRowClassName?: (row: Row<TData>) => string;
  // REMINDER: make sure to pass the correct id to access the rows
  getRowId?: TableOptions<TData>["getRowId"];
  data: TData[];
  columnOrder?: string[];
  // Number of skeleton rows to render while loading
  skeletonRowCount?: number;
  // Number of skeleton rows to render while loading the next page
  skeletonNextPageRowCount?: number;
  columnFilters: ColumnFiltersState;
  onColumnFiltersChange: OnChangeFn<ColumnFiltersState>;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
  filterFields?: DataTableFilterField<TData>[];
  sheetFields?: SheetField<TData, TMeta>[];
  meta: DataTableMeta<TMeta, TFavorite>;
  isFetching?: boolean;
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  fetchNextPage: (
    options?: FetchNextPageOptions | undefined,
  ) => Promise<unknown>;
  isError?: boolean;
  error?: unknown;
  onRetry?: () => Promise<unknown> | void;
  renderSheetTitle: (props: { row?: Row<TData> }) => React.ReactNode;
  // Optional ref target to programmatically focus the table body
  focusTargetRef?: React.Ref<HTMLTableSectionElement>;
  account?: {
    user: AccountUser | null | undefined;
    onSignOut: () => void;
    isSigningOut: boolean;
    onSignIn?: () => void;
    onSignUp?: () => void;
    isLoading?: boolean;
  };
  headerSlot?: React.ReactNode;
  mobileHeaderOffset?: string;
  navItems?: NavItem[];
  renderCheckedActions?: (
    meta: DataTableMeta<TMeta, TFavorite>,
  ) => React.ReactNode;
  renderSheetCharts?: (row: Row<TData> | null) => React.ReactNode;
  primaryColumnId?: string;
}

export function DataTableInfinite<TData, TValue, TMeta, TFavorite = FavoriteKey>({
  columns,
  getRowClassName,
  getRowId,
  data,
  columnOrder,
  skeletonRowCount = 50,
  skeletonNextPageRowCount,
  columnFilters,
  onColumnFiltersChange,
  sorting,
  onSortingChange,
  rowSelection,
  onRowSelectionChange,
  filterFields = [],
  sheetFields = [],
  isFetching,
  isLoading,
  isFetchingNextPage,
  fetchNextPage,
  hasNextPage,
  isError,
  error,
  onRetry = noop,
  meta,
  renderSheetTitle,
  focusTargetRef,
  account,
  headerSlot,
  mobileHeaderOffset,
  navItems,
  renderCheckedActions,
  renderSheetCharts,
  primaryColumnId = "gpu_model",
}: DataTableInfiniteProps<TData, TValue, TMeta, TFavorite>) {
  // Independent checkbox-only state (does not control the details pane)
  const [checkedRows, setCheckedRows] = React.useState<Record<string, boolean>>({});
  const missingRowIdWarningRef = React.useRef(false);
  const toggleCheckedRow = React.useCallback((rowId: string, next?: boolean) => {
    setCheckedRows((prev) => {
      const shouldCheck = typeof next === "boolean" ? next : !prev[rowId];
      if (shouldCheck) return { ...prev, [rowId]: true };
      const { [rowId]: _omit, ...rest } = prev;
      return rest;
    });
  }, []);

  const tableRef = React.useRef<HTMLTableElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const accountUser: AccountUser | null = account?.user ?? null;
  const accountOnSignOut = account?.onSignOut ?? noop;
  const accountIsSigningOut = account?.isSigningOut ?? false;
  const accountOnSignIn = account?.onSignIn;
  const accountOnSignUp = account?.onSignUp;
  const accountIsLoading = account?.isLoading ?? false;
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [isDesktopSearchOpen, setIsDesktopSearchOpen] = React.useState(false);
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
  const searchFilterField = React.useMemo(
    () =>
      filterFields.find(
        (field): field is DataTableInputFilterField<TData> =>
          field.type === "input" && field.value === "search",
      ),
    [filterFields],
  );
  const toggleDesktopSearch = React.useCallback(() => {
    setIsDesktopSearchOpen((prev) => !prev);
  }, []);
  React.useEffect(() => {
    setIsDesktopSearchOpen(false);
  }, [pathname]);
  const searchFieldId =
    (searchFilterField?.value as string | undefined) ?? undefined;
  useGlobalHotkeys(
    React.useMemo(
      () =>
        searchFieldId
          ? [
              {
                combo: "mod+/",
                handler: () => setIsDesktopSearchOpen((prev) => !prev),
                allowWhenFocusedIds: [searchFieldId],
              },
            ]
          : [],
      [searchFieldId],
    ),
  );
  const resolvedNavItems = React.useMemo(() => {
    const baseItems: NavItem[] = navItems ?? DEFAULT_NAV_ITEMS;

    return baseItems.map((item) => {
      const isCurrent =
        typeof item.isCurrent === "boolean"
          ? item.isCurrent
          : pathname === "/"
            ? item.value === "/llms"
            : pathname.startsWith(item.value);
      return { ...item, isCurrent };
    });
  }, [navItems, pathname]);
  const currentNavValue =
    resolvedNavItems.find((item) => item.isCurrent)?.value ?? "/llms";
  const handleNavChange = React.useCallback(
    (value: string) => {
      if (!value) return;
      if (value === pathname) return;
      router.push(value);
    },
    [pathname, router],
  );
  const mobileHeightClass = mobileHeaderOffset
    ? "h-[calc(100dvh-var(--total-padding-mobile)-var(--mobile-header-offset))]"
    : "h-[calc(100dvh-var(--total-padding-mobile))]";
  const mobileHeightStyle = React.useMemo(() => {
    if (!mobileHeaderOffset) return undefined;
    const trimmed = mobileHeaderOffset.replace(/\s+/g, "");
    const spacedChars: string[] = [];
    for (let index = 0; index < trimmed.length; index++) {
      const char = trimmed[index];
      if (char === "+") {
        spacedChars.push(" ", "+", " ");
        continue;
      }
      if (char === "-") {
        const prev = trimmed[index - 1];
        const next = trimmed[index + 1];
        if (prev === "-" || next === "-") {
          spacedChars.push(char);
          continue;
        }
        spacedChars.push(" ", "-", " ");
        continue;
      }
      spacedChars.push(char);
    }
    const normalized = spacedChars.join("").replace(/\s{2,}/g, " ").trim();
    const offsetValue = normalized.startsWith("calc(")
      ? normalized
      : `calc(${normalized})`;
    return {
      "--mobile-header-offset": offsetValue,
    } as React.CSSProperties;
  }, [mobileHeaderOffset]);

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
  }, []);

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


  const resolvedGetRowId = React.useMemo(() => {
    if (getRowId) {
      return getRowId;
    }

    return (originalRow: TData, index: number, _parent?: Row<TData>) => {
      if (
        originalRow &&
        typeof originalRow === "object" &&
        "id" in (originalRow as Record<string, unknown>)
      ) {
        const rawId = (originalRow as Record<string, unknown>).id;
        if (typeof rawId === "string" || typeof rawId === "number") {
          return String(rawId);
        }
      }

      if (process.env.NODE_ENV !== "production" && !missingRowIdWarningRef.current) {
        missingRowIdWarningRef.current = true;
        console.warn(
          "[DataTableInfinite] Falling back to index-based row ids. " +
            "Pass `getRowId` or ensure each row has a stable `id` to keep favorites in sync.",
        );
      }

      return String(index);
    };
  }, [getRowId]);

  const table = useReactTable({
    data,
    columns,
    // Server-side operations (TanStack Table best practice)
    manualFiltering: true,
    manualSorting: true,
    manualPagination: true,
    initialState: {
      ...(columnOrder ? { columnOrder } : {}),
      // Initialize from URL state (TanStack Table best practice)
      columnFilters,
      sorting,
      pagination: {
        pageIndex: 0,
        pageSize: 50,
      },
    },
    state: {
      columnFilters,
      sorting,
      rowSelection,
      ...(columnOrder ? { columnOrder } : {}),
    },
    enableMultiRowSelection: false,
    enableColumnResizing: true,
    enableMultiSort: false,
    columnResizeMode: "onChange",
    getRowId: resolvedGetRowId,
    onColumnFiltersChange,
    onRowSelectionChange,
    onSortingChange,
    enableHiding: false,
    enableSorting: true, // Enable sorting UI for manual server-side sorting
    getCoreRowModel: getCoreRowModel(),
    // Facets are provided by the server; expose them via provider callbacks
    // to power filter UIs without re-filtering rows client-side
    // Note: we intentionally do not call getFilteredRowModel/getFacetedRowModel
    debugAll: process.env.NEXT_PUBLIC_TABLE_DEBUG === "true",
    meta: {
      getRowClassName,
    },
  });


  // Table rows for rendering order
  const rows = table.getRowModel().rows;
  const columnSizing = table.getState().columnSizing;
  const visibleLeafColumns = table.getVisibleLeafColumns();
  // Stable key for column sizing - only changes when actual sizes change (not on every render)
  const columnSizingKey = JSON.stringify(columnSizing);
  const primaryColumn = React.useMemo(
    () => table.getColumn(primaryColumnId),
    [primaryColumnId, table],
  );
  const overscan = React.useMemo(() => {
    if (!rows.length) return derivedOverscan;
    return Math.min(Math.max(1, derivedOverscan), rows.length);
  }, [rows.length, derivedOverscan]);

  React.useEffect(() => {
    if (!rows.length) {
      setCheckedRows((previous) => {
        if (Object.keys(previous).length === 0) {
          return previous;
        }
        return {};
      });
      return;
    }

    const visibleRowIds = new Set(rows.map((row) => row.id));
    setCheckedRows((previous) => {
      let didChange = false;
      const next: Record<string, boolean> = {};

      for (const key in previous) {
        if (visibleRowIds.has(key)) {
          next[key] = true;
        } else {
          didChange = true;
        }
      }

      if (!didChange && Object.keys(previous).length === visibleRowIds.size) {
        return previous;
      }

      return didChange ? next : previous;
    });
  }, [rows, setCheckedRows]);

  // Virtual scrolling setup - properly configured to reduce DOM size
  const virtualizationEnabled =
    !isLoading && !(isFetching && !data.length) && rows.length > 0;

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT_PX, // Row height in pixels
    overscan,
    enabled: virtualizationEnabled,
  });

  const measureVirtualRow = virtualizationEnabled
    ? rowVirtualizer.measureElement
    : undefined;

  // Get virtual items (cached to avoid multiple calls)
  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const showErrorState = Boolean(isError);
  const errorMessage = React.useMemo(() => getErrorMessage(error), [error]);


  const previousFiltersRef = React.useRef<ColumnFiltersState | null>(null);
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTop = 0;
  }, [sorting]);

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
  }, [columnFilters]);

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

  const selectedRow = React.useMemo(() => {
    if ((isLoading || isFetching) && !data.length) return;
    const selectedRowKey = Object.keys(rowSelection)?.[0];
    return table
      .getCoreRowModel()
      .flatRows.find((row) => row.id === selectedRowKey);
  }, [rowSelection, table, isLoading, isFetching, data]);

  // Selection sync limited to the current batch

  const getFacetedUniqueValues = React.useCallback(
    (table: TTable<TData>, columnId: string) => {
      const facets = meta.facets;
      if (!facets) return undefined;

      const facetData = facets[columnId];
      if (!facetData || typeof facetData !== 'object' || !('rows' in facetData)) {
        return new Map<string, number>();
      }

      const map = new Map<string, number>();
      facetData.rows.forEach((row: any) => {
        if (row && typeof row === 'object' && 'value' in row && 'total' in row) {
          map.set(String(row.value), Number(row.total));
        }
      });

      return map;
    },
    [meta.facets]
  );

  const getFacetedMinMaxValues = React.useCallback(
    (table: TTable<TData>, columnId: string) => {
      const facets = meta.facets;
      if (!facets) return undefined;

      const facetData = facets[columnId];
      if (!facetData || typeof facetData !== 'object' || !('rows' in facetData)) return undefined;

      // For numeric columns, find min/max values
      const numericValues: number[] = facetData.rows
        .map((row: any) => {
          if (row && typeof row === 'object' && 'value' in row) {
            const num = Number(row.value);
            return isNaN(num) ? null : num;
          }
          return null;
        })
        .filter((val: number | null): val is number => val !== null);

      if (numericValues.length === 0) return undefined;

      return [Math.min(...numericValues), Math.max(...numericValues)] as [number, number];
    },
    [meta.facets]
  );

  const checkedActions = React.useMemo(() => {
    if (renderCheckedActions) {
      return renderCheckedActions(meta);
    }
    return (
      <CheckedActionsIsland
        initialFavoriteKeys={
          (meta.initialFavoriteKeys as FavoriteKey[] | undefined) ?? undefined
        }
      />
    );
  }, [meta, renderCheckedActions]);

  return (
    <DataTableProvider
      table={table}
      columns={columns}
      filterFields={filterFields}
      columnFilters={columnFilters}
      sorting={sorting}
      rowSelection={rowSelection}
      checkedRows={checkedRows}
      toggleCheckedRow={toggleCheckedRow}
      setCheckedRows={setCheckedRows}
      setColumnFilters={
        onColumnFiltersChange as Dispatch<SetStateAction<ColumnFiltersState>>
      }
      setRowSelection={
        onRowSelectionChange as Dispatch<SetStateAction<RowSelectionState>>
      }
      enableColumnOrdering={false}
      isLoading={isFetching || isLoading}
      getFacetedUniqueValues={getFacetedUniqueValues}
      getFacetedMinMaxValues={getFacetedMinMaxValues}
    >
      <div className="flex flex-col gap-2 sm:gap-4">
        {headerSlot}
        <div className="grid h-full grid-cols-1 gap-0 sm:grid-cols-[18rem_1fr]">
          <div
            className={cn(
              "hidden sm:flex h-[calc(100dvh-var(--total-padding-mobile))] sm:h-[100dvh] flex-col sticky top-0 self-start min-w-72 max-w-72 rounded-lg overflow-hidden"
            )}
          >
            <div className="flex h-full w-full flex-col">
              <div className="mx-auto w-full max-w-full p-4 border-b border-border mb-4 space-y-4">
                <div className="flex items-center gap-2">
                  {searchFilterField && isDesktopSearchOpen ? (
                    <div className="w-full">
                      <DataTableFilterInput
                        autoFocus={isDesktopSearchOpen}
                        {...searchFilterField}
                      />
                    </div>
                  ) : (
                    <Select
                      value={currentNavValue}
                      onValueChange={handleNavChange}
                      onOpenChange={(open) => {
                        // Prefetch all nav routes when Select opens
                        if (open) {
                          resolvedNavItems.forEach((item) => {
                            if (item.value !== pathname) {
                              router.prefetch(item.value);
                            }
                          });
                        }
                      }}
                      hotkeys={[
                        { combo: "cmd+k", value: "/llms" },
                        { combo: "cmd+g", value: "/gpus" },
                        { combo: "cmd+e", value: "/tools" },
                      ]}
                    >
                      <SelectTrigger className="h-9 w-full justify-between rounded-lg shadow-sm" aria-label="Page navigation">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {resolvedNavItems.map((item) => (
                          <SelectItem
                            key={item.value}
                            value={item.value}
                            className="gap-2 cursor-pointer"
                            shortcut={item.shortcut}
                          >
                            <item.icon className="h-4 w-4" aria-hidden="true" />
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {searchFilterField ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={toggleDesktopSearch}
                      aria-pressed={isDesktopSearchOpen}
                      className="shrink-0 rounded-lg bg-gradient-to-b from-muted/70 via-muted/40 to-background shadow-sm"
                    >
                      <Search className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">Search</span>
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-hide">
                <div className="mx-auto w-full max-w-full px-4 pb-4">
                  <DataTableFilterControls showSearch={false} />
                </div>
              </div>
              <div className="flex-shrink-0 p-4 border-t border-border">
                <UserMenu
                  user={accountUser}
                  onSignOut={accountOnSignOut}
                  isSigningOut={accountIsSigningOut}
                  isAuthenticated={Boolean(accountUser)}
                  forceUnauthSignInButton
                  onSignIn={accountOnSignIn}
                  onSignUp={accountOnSignUp}
                  isLoading={accountIsLoading}
                />
              </div>
            </div>
          </div>
          <div
            className={cn(
              "flex max-w-full flex-1 flex-col min-w-0"
            )}
            data-table-container=""
          >
            <div className={cn("z-0 flex flex-col", mobileHeightClass, "sm:h-[100dvh]")} style={mobileHeightStyle}>
              <div
                className={cn(
                  "border-0 sm:border-l bg-background overflow-hidden flex-1 min-h-0 flex flex-col"
                )}
              >
                <Table
                  ref={tableRef}
                  onScroll={onScroll}
                  containerRef={containerRef}
                  containerOverflowVisible={false}
                  // REMINDER: https://stackoverflow.com/questions/questions/50361698/border-style-do-not-work-with-sticky-position-element
                  className="border-separate border-spacing-0 w-full table-fixed"
                  style={{
                    width: "100%",
                    minWidth: `${fixedColumnsWidth + minimumModelColumnWidth}px`,
                  }}
                  containerClassName={cn(
                    "h-full overscroll-x-none scrollbar-hide flex-1 min-h-0"
                  )}
                >
              <TableHeader className={cn("sticky top-0 z-50 bg-background")}>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className={cn("bg-muted")}
                  >
                    {headerGroup.headers.map((header) => {
                      const isModelColumn = primaryColumnId
                        ? header.id === primaryColumnId
                        : false;
                      const headerRef = getHeaderRef(header.id);
                      
                      // Custom resize handler that captures the actual rendered width when using "auto"
                      // Following React best practices: refs accessed only in event handlers, not during render
                      // Production-ready: includes null checks, proper cleanup, and browser compatibility
                      // Note: Regular function (not useCallback) because we're inside a map callback
                      // This is fine - function is recreated per header but only executes on user interaction
                      const handleResizeStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
                        const resizeHandler = header.getResizeHandler();
                        if (!resizeHandler) {
                          return;
                        }

                        if (!isModelColumn) {
                          resizeHandler(e);
                          return;
                        }

                        if (pendingModelColumnResizeRef.current) {
                          return;
                        }

                        const columnSizing = table.getState().columnSizing;
                        const hasBeenResized = header.id in columnSizing || modelColumnHasBeenResizedRef.current;

                        if (!hasBeenResized && header.getSize() === modelColumnDefaultSize) {
                          modelColumnHasBeenResizedRef.current = true;
                          pendingModelColumnResizeRef.current = true;

                          const fallbackSize = header.getSize();
                          const measuredWidth = modelColumnMeasuredWidthRef.current ?? fallbackSize;
                          const widthToSet =
                            measuredWidth && measuredWidth > 0
                              ? Math.max(measuredWidth, fallbackSize, minimumModelColumnWidth)
                              : Math.max(fallbackSize, minimumModelColumnWidth);

                          const currentSizing = table.getState().columnSizing;
                          table.setColumnSizing({
                            ...currentSizing,
                            [header.id]: widthToSet,
                          });

                          const syntheticEvent = {
                            ...e,
                            currentTarget: e.currentTarget,
                            target: e.target,
                          } as typeof e;

                          requestAnimationFrame(() => {
                            const handler = header.getResizeHandler();
                            if (!handler) {
                              pendingModelColumnResizeRef.current = false;
                              return;
                            }
                            handler(syntheticEvent);
                            pendingModelColumnResizeRef.current = false;
                          });

                          e.preventDefault();
                          e.stopPropagation();
                          return;
                        }

                        modelColumnHasBeenResizedRef.current = true;
                        resizeHandler(e);
                      };
                      
                      return (
                        <TableHead
                          key={header.id}
                          ref={headerRef}
                          className={cn(
                            "relative select-none truncate border-b border-border bg-background text-foreground [&>.cursor-col-resize]:last:opacity-0",
                            header.column.columnDef.meta?.headerClassName,
                          )}
                          data-column-id={header.column.id}
                          style={{
                            width: getModelColumnWidth(header.id, header.getSize()),
                            minWidth:
                              isModelColumn
                                ? `${minimumModelColumnWidth}px`
                                : header.column.columnDef.minSize,
                          }}
                          aria-sort={
                            header.column.getIsSorted() === "asc"
                              ? "ascending"
                              : header.column.getIsSorted() === "desc"
                              ? "descending"
                              : "none"
                          }
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                          {header.column.getCanResize() && (
                            <div
                              onDoubleClick={() => {
                                // Reset all resize tracking state
                                modelColumnMeasuredWidthRef.current = null;
                                modelColumnHasBeenResizedRef.current = false;
                                // Clear the column from sizing state so it can return to "auto"
                                const currentSizing = table.getState().columnSizing;
                                const { [header.id]: _, ...restSizing } = currentSizing;
                                table.setColumnSizing(restSizing);
                                header.column.resetSize();
                              }}
                              onMouseDown={isModelColumn ? handleResizeStart : header.getResizeHandler()}
                              onTouchStart={isModelColumn ? handleResizeStart : header.getResizeHandler()}
                              className={cn(
                                "user-select-none absolute -right-2 top-0 z-10 flex h-full w-4 cursor-col-resize touch-none justify-center",
                                "before:absolute before:inset-y-0 before:w-px before:translate-x-px before:bg-border",
                              )}
                            />
                          )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody
                id="content"
                tabIndex={-1}
                ref={focusTargetRef}
                className="outline-1 -outline-offset-1 outline-primary transition-colors focus-visible:outline"
                // REMINDER: avoids scroll (skipping the table header) when using skip to content
                style={{
                  scrollMarginTop: "40px",
                }}
                aria-busy={Boolean(isLoading || (isFetching && !data.length))}
                aria-live="polite"
              >
                {showErrorState ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="py-10">
                      <div className="flex flex-col gap-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive-foreground sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <p className="font-medium">We couldn’t load GPU rows.</p>
                          <p className="text-muted-foreground">{errorMessage}</p>
                        </div>
                        <Button
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={() => {
                            if (typeof onRetry === "function") {
                              void onRetry();
                            }
                          }}
                        >
                          Retry
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : isLoading || (isFetching && !data.length) ? (
                  <RowSkeletons
                    table={table}
                    rows={skeletonRowCount}
                    modelColumnWidth={`${minimumModelColumnWidth}px`}
                    primaryColumnId={primaryColumnId}
                  />
                ) : rows.length ? (
                  <>
                    {!virtualizationEnabled && rows.length ? (
                      rows.map((row, index) => (
                        <React.Fragment key={row.id}>
                          <MemoizedRow
                            row={row}
                            table={table}
                            selected={row.getIsSelected()}
                            checked={checkedRows[row.id] ?? false}
                            data-index={index}
                            getModelColumnWidth={getModelColumnWidth}
                            primaryColumnId={primaryColumnId}
                          />
                        </React.Fragment>
                      ))
                    ) : virtualItems.length === 0 ? (
                      <RowSkeletons
                        table={table}
                        rows={Math.min(rows.length || skeletonRowCount, 50)}
                        modelColumnWidth={`${minimumModelColumnWidth}px`}
                        primaryColumnId={primaryColumnId}
                      />
                    ) : (
                      <>
                        {/* Virtual spacer for rows before visible range */}
                        {virtualItems[0]?.index > 0 && (
                          <tr aria-hidden style={{ height: `${virtualItems[0].start}px`, border: 0 }}>
                            <td colSpan={columns.length} style={{ padding: 0, border: 0 }} />
                          </tr>
                        )}
                        {/* Render only visible virtual items (reduces DOM size) */}
                        {virtualItems.map((virtualItem) => {
                          const row = rows[virtualItem.index];
                          if (!row) return null;

                          return (
                            <React.Fragment key={virtualItem.key}>
                              <MemoizedRow
                                row={row}
                                table={table}
                                selected={row.getIsSelected()}
                                checked={checkedRows[row.id] ?? false}
                                data-index={virtualItem.index}
                                ref={measureVirtualRow}
                                getModelColumnWidth={getModelColumnWidth}
                                primaryColumnId={primaryColumnId}
                              />
                            </React.Fragment>
                          );
                        })}
                        {/* Virtual spacer for rows after visible range */}
                        {virtualItems[virtualItems.length - 1]?.index < rows.length - 1 && (
                          <tr aria-hidden style={{ 
                            height: `${totalSize - virtualItems[virtualItems.length - 1].end}px`, 
                            border: 0 
                          }}>
                            <td colSpan={columns.length} style={{ padding: 0, border: 0 }} />
                          </tr>
                        )}
                      </>
                    )}
                    {(hasNextPage && (isFetchingNextPage || isPrefetching)) && (
                      <RowSkeletons
                        table={table}
                        rows={
                          typeof skeletonNextPageRowCount === "number"
                            ? skeletonNextPageRowCount
                            : Math.max(overscan * 2, 20)
                        }
                        modelColumnWidth={`${minimumModelColumnWidth}px`}
                        primaryColumnId={primaryColumnId}
                      />
                    )}
                  </>
                ) : (
                  <React.Fragment>
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center"
                      >
                        No results.
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      </div>
      <DataTableSheetDetails
        title={renderSheetTitle({ row: selectedRow })}
        titleClassName="font-mono"
      >
        <div className="space-y-0">
          <MemoizedDataTableSheetContent
            table={table}
            data={selectedRow?.original}
            filterFields={filterFields}
            fields={sheetFields}
            // Memoization can be added later if needed
            // REMINDER: this is used to pass additional data like the `InfiniteQueryMeta`
            metadata={meta}
          />
          <div className="border-t border-border/60 pt-4">
            {renderSheetCharts ? (
              renderSheetCharts(selectedRow ?? null)
            ) : selectedRow?.original ? (
              <LazyGpuSheetCharts
                stableKey={(selectedRow.original as any)?.stable_key}
              />
            ) : null}
          </div>
        </div>
      </DataTableSheetDetails>
      {checkedActions}
    </DataTableProvider>
  );
}

/**
 * REMINDER: this is the heaviest component in the table if lots of rows
 * Some other components are rendered more often necessary, but are fixed size (not like rows that can grow in height)
 * e.g. DataTableFilterControls, DataTableFilterCommand, DataTableToolbar, DataTableHeader
 */

function Row<TData>({
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
  const modelColumnDefaultSize = columnMeta?.size ?? 275;

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
        const stopPropagation = (e: any) => {
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

const MemoizedRow = React.memo(
  Row,
  (prev, next) =>
    prev.row.id === next.row.id &&
    Object.is(prev.row.original, next.row.original) &&
    prev.selected === next.selected &&
    prev.checked === next.checked &&
    prev["data-index"] === next["data-index"] &&
    prev.getModelColumnWidth === next.getModelColumnWidth,
) as typeof Row;

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

function getErrorMessage(error: unknown) {
  if (!error) {
    return "Something went wrong while fetching data.";
  }
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message || "Request failed.";
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "Request failed.";
  }
}
