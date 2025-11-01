"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/custom/table";
import { DataTableProvider } from "@/components/data-table/data-table-provider";
import { DataTableFilterControls } from "@/components/data-table/data-table-filter-controls";
import { DataTableFilterInput } from "@/components/data-table/data-table-filter-input";
import { MemoizedDataTableSheetContent } from "@/components/data-table/data-table-sheet/data-table-sheet-content";
import { DataTableSheetDetails } from "@/components/data-table/data-table-sheet/data-table-sheet-details";
import type {
  DataTableFilterField,
  SheetField,
  DataTableInputFilterField,
} from "@/components/data-table/types";
import { cn } from "@/lib/utils";
import { type FetchNextPageOptions } from "@tanstack/react-query";
import * as React from "react";
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
import { useQueryStates, type ParserBuilder } from "nuqs";
import { searchParamsParser } from "./search-params";
import { RowSkeletons } from "./_components/row-skeletons";
import { CheckedActionsIsland } from "./_components/checked-actions-island";
import { filterFields, sheetFields } from "./constants";
import { UserMenu, type AccountUser } from "./account-components";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { DesktopNavTabs, type DesktopNavItem } from "./nav-tabs";

const noop = () => {};
const gradientSurfaceClass =
  "border border-border bg-gradient-to-b from-muted/70 via-muted/40 to-background text-foreground";

// Note: chart groupings could be added later if needed
export interface DataTableInfiniteProps<TData, TValue, TMeta> {
  columns: ColumnDef<TData, TValue>[];
  getRowClassName?: (row: Row<TData>) => string;
  // REMINDER: make sure to pass the correct id to access the rows
  getRowId?: TableOptions<TData>["getRowId"];
  data: TData[];
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
  totalRows?: number;
  filterRows?: number;
  totalRowsFetched?: number;
  meta: TMeta & { facets?: Record<string, any> };
  isFetching?: boolean;
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  fetchNextPage: (
    options?: FetchNextPageOptions | undefined,
  ) => Promise<unknown>;
  renderSheetTitle: (props: { row?: Row<TData> }) => React.ReactNode;
  searchParamsParser: Record<string, ParserBuilder<any>>;
  // Optional ref target to programmatically focus the table body
  focusTargetRef?: React.Ref<HTMLTableSectionElement>;
  account?: {
    user: AccountUser | null | undefined;
    onSignOut: () => void;
    isSigningOut: boolean;
    onSignIn?: () => void;
    onSignUp?: () => void;
  };
  headerSlot?: React.ReactNode;
  mobileHeaderOffset?: string;
}

export function DataTableInfinite<TData, TValue, TMeta>({
  columns,
  getRowClassName,
  getRowId,
  data,
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
  totalRows = 0,
  filterRows = 0,
  totalRowsFetched = 0,
  meta,
  renderSheetTitle,
  searchParamsParser: searchParamsParserProp,
  focusTargetRef,
  account,
  headerSlot,
  mobileHeaderOffset,
}: DataTableInfiniteProps<TData, TValue, TMeta>) {
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
  // searchParamsParser is provided as a prop
  const [_, setSearch] = useQueryStates(searchParamsParserProp);

  const accountUser: AccountUser | null = account?.user ?? null;
  const accountOnSignOut = account?.onSignOut ?? noop;
  const accountIsSigningOut = account?.isSigningOut ?? false;
  const accountOnSignIn = account?.onSignIn;
  const accountOnSignUp = account?.onSignUp;
  const pathname = usePathname() ?? "";
  const [isDesktopSearchOpen, setIsDesktopSearchOpen] = React.useState(false);
  // Detect mobile once and reuse
  const [isMobile, setIsMobile] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 640;
  });
  
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
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
  const navigationItems = React.useMemo<DesktopNavItem[]>(
    () => [
      {
        type: "link",
        href: "/llms",
        label: "LLMs",
        isActive: pathname === "/" || pathname.startsWith("/llms"),
      },
      {
        type: "link",
        href: "/gpus",
        label: "GPUs",
        isActive: pathname.startsWith("/gpus"),
      },
      {
        type: "link",
        href: "/tools",
        label: "Tools",
        isActive: pathname.startsWith("/tools"),
      },
      {
        type: "action",
        label: "Search",
        icon: Search,
        isActive: isDesktopSearchOpen,
        onSelect: toggleDesktopSearch,
      },
    ],
    [isDesktopSearchOpen, pathname, toggleDesktopSearch],
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

  // User menu functionality
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
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, isPrefetching]);

  const onScroll = React.useCallback(
    (e: React.UIEvent<HTMLElement>) => {
      const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
      const distanceToBottom = scrollHeight - (scrollTop + clientHeight);
      // Use smaller threshold on mobile to trigger earlier
      const threshold = isMobile ? 300 : 600;
      if (distanceToBottom <= threshold) {
        requestNextPage();
      }
    },
    [requestNextPage, isMobile],
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
    // Total row count for pagination calculation
    rowCount: totalRows,
    initialState: {
      columnOrder: [
        "blank",
        "provider",
        "gpu_model",
        "price_hour_usd",
        "gpu_count",
        "vram_gb",
        "vcpus",
        "system_ram_gb",
        "type",
      ],
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
      metadata: { totalRows, filterRows, totalRowsFetched },
    },
  });


  // Table rows for rendering order
  const rows = table.getRowModel().rows;

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
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 45, // Row height in pixels
    overscan: isMobile ? 25 : 50, // Mobile: 25, Desktop: 50 extra rows above/below viewport
    enabled: !isLoading && !(isFetching && !data.length) && rows.length > 0,
  });

  // Get virtual items (cached to avoid multiple calls)
  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  
  // Force virtualizer to recalculate when rows change (important for pagination)
  React.useEffect(() => {
    if (rows.length > 0 && containerRef.current) {
      // Small delay to ensure DOM is updated before measuring
      requestAnimationFrame(() => {
        rowVirtualizer.measure();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // rowVirtualizer is a stable reference from useVirtualizer hook
  }, [rows.length]);

  const sentinelNodeRef = React.useRef<HTMLTableRowElement | null>(null);
  const sentinelRef = React.useCallback((node: HTMLTableRowElement | null) => {
    sentinelNodeRef.current = node;
  }, []);
  React.useEffect(() => {
    const node = sentinelNodeRef.current;
    if (!node) return;
    const root = containerRef.current ?? undefined;
    // Use more aggressive rootMargin on mobile (smaller screens) to trigger earlier
    const rootMargin = isMobile ? "300px 0px 0px 0px" : "600px 0px 0px 0px";
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          requestNextPage();
        }
      },
      { root, rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [requestNextPage, rows.length, isMobile]);

  const previousFiltersRef = React.useRef<string>("__init__");
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTop = 0;
  }, [sorting]);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const serializedFilters = JSON.stringify(columnFilters ?? []);
    if (previousFiltersRef.current === serializedFilters) {
      return;
    }
    previousFiltersRef.current = serializedFilters;
    container.scrollTop = 0;
  }, [columnFilters]);

  const minimumModelColumnWidth =
    table.getColumn("gpu_model")?.columnDef.minSize ?? 250;
  const fixedColumnsWidth = table
    .getVisibleLeafColumns()
    .filter((column) => column.id !== "gpu_model")
    .reduce((acc, column) => acc + column.getSize(), 0);

  const modelColumnWidth = React.useMemo(() => {
    return `max(${minimumModelColumnWidth}px, calc(100% - ${fixedColumnsWidth}px))`;
  }, [minimumModelColumnWidth, fixedColumnsWidth]);

  const tableWidthStyle = React.useMemo(
    () =>
      ({
        width: "100%",
        minWidth: `${fixedColumnsWidth + minimumModelColumnWidth}px`,
        "--model-column-width": modelColumnWidth,
      }) as React.CSSProperties,
    [fixedColumnsWidth, minimumModelColumnWidth, modelColumnWidth],
  );

  const previousSearchPayloadRef = React.useRef<string>("");

  React.useEffect(() => {
    const searchPayload: Record<string, unknown> = {};

    filterFields.forEach((field) => {
      const columnFilter = columnFilters.find((filter) => filter.id === field.value);
      searchPayload[field.value as string] = columnFilter ? columnFilter.value : null;
    });

    const payloadString = JSON.stringify(searchPayload);
    if (previousSearchPayloadRef.current === payloadString) {
      return;
    }

    previousSearchPayloadRef.current = payloadString;
    setSearch(searchPayload);
  }, [columnFilters, filterFields, setSearch]);

  const previousSortParamRef = React.useRef<string>("__init__");
  React.useEffect(() => {
    const sortEntry = sorting?.[0] ?? null;
    const serializedSort =
      sortEntry === null
        ? "null"
        : `${sortEntry.id}:${sortEntry.desc ? "desc" : "asc"}`;
    if (previousSortParamRef.current === serializedSort) {
      return;
    }
    previousSortParamRef.current = serializedSort;
    setSearch({ sort: sortEntry ?? null });
  }, [setSearch, sorting]);

  const selectedRow = React.useMemo(() => {
    if ((isLoading || isFetching) && !data.length) return;
    const selectedRowKey = Object.keys(rowSelection)?.[0];
    return table
      .getCoreRowModel()
      .flatRows.find((row) => row.id === selectedRowKey);
  }, [rowSelection, table, isLoading, isFetching, data]);

  // Selection sync limited to the current batch
  const previousUuidRef = React.useRef<string>("__init__");
  React.useEffect(() => {
    if (isLoading || isFetching) return;
    const selectedKeys = Object.keys(rowSelection ?? {});
    const nextUuid = selectedKeys[0] ?? null;

    if (selectedKeys.length && !selectedRow) {
      previousUuidRef.current = "null";
      setSearch({ uuid: null });
      onRowSelectionChange({});
      return;
    }

    const serializedUuid = nextUuid ?? "null";
    if (previousUuidRef.current === serializedUuid) {
      return;
    }

    previousUuidRef.current = serializedUuid;
    setSearch({ uuid: nextUuid });
  }, [isFetching, isLoading, onRowSelectionChange, rowSelection, selectedRow, setSearch]);


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
      setColumnFilters={onColumnFiltersChange as (filters: ColumnFiltersState) => void}
      setRowSelection={onRowSelectionChange as (selection: RowSelectionState) => void}
      enableColumnOrdering={false}
      isLoading={isFetching || isLoading}
      getFacetedUniqueValues={getFacetedUniqueValues}
      getFacetedMinMaxValues={getFacetedMinMaxValues}
    >
      <div className="flex flex-col gap-2 sm:gap-4">
        {headerSlot}
        <div className="grid h-full grid-cols-1 gap-4 sm:grid-cols-[13rem_1fr] md:grid-cols-[18rem_1fr]">
          <div
            className={cn(
              "hidden sm:flex h-[calc(100dvh-var(--total-padding-mobile))] sm:h-[100dvh] flex-col sticky top-0 min-w-52 max-w-52 self-start md:min-w-72 md:max-w-72 rounded-lg overflow-hidden"
            )}
          >
            <div className="flex h-full w-full flex-col">
              <div className="mx-auto w-full max-w-full pl-4 pr-0 pt-4 mb-6 space-y-4">
                <DesktopNavTabs
                  items={navigationItems}
                  className={gradientSurfaceClass}
                />
                {searchFilterField ? (
                  <>
                    <div className="flex items-center gap-2 sm:hidden">
                      <div className="flex-1">
                        <DataTableFilterInput {...searchFilterField} />
                      </div>
                    </div>
                    {isDesktopSearchOpen ? (
                      <div className="hidden items-center gap-2 sm:flex">
                        <div className="flex-1">
                          <DataTableFilterInput {...searchFilterField} />
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-hide">
                <div className="mx-auto w-full max-w-full pl-4 pr-0 pb-4">
                  <DataTableFilterControls showSearch={false} />
                </div>
              </div>
              <div className="flex-shrink-0 pl-2 pb-2 pt-0 pr-0">
                <UserMenu
                  user={accountUser}
                  onSignOut={accountOnSignOut}
                  isSigningOut={accountIsSigningOut}
                  isAuthenticated={Boolean(accountUser)}
                  forceUnauthSignInButton
                  onSignIn={accountOnSignIn}
                  onSignUp={accountOnSignUp}
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
                  "border-0 md:border-l bg-background overflow-hidden flex-1 min-h-0 flex flex-col"
                )}
              >
                <Table
                  ref={tableRef}
                  onScroll={onScroll}
                  containerRef={containerRef}
                  containerOverflowVisible={false}
                  // REMINDER: https://stackoverflow.com/questions/questions/50361698/border-style-do-not-work-with-sticky-position-element
                  className="border-separate border-spacing-0 w-auto min-w-full table-fixed"
                  style={tableWidthStyle}
                  containerClassName={cn(
                    "h-full overscroll-x-none scrollbar-hide flex-1 min-h-0"
                  )}
                >
              <TableHeader className={cn("sticky top-0 z-50 bg-background")}>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className={cn(
                      "bg-muted",
                      "[&>:not(:last-child)]:border-r",
                    )}
                  >
                    {headerGroup.headers.map((header) => {
                      const isModelColumn = header.id === "gpu_model";
                      return (
                        <TableHead
                          key={header.id}
                          className={cn(
                            "relative select-none truncate border-b border-border bg-background text-foreground/70 [&>.cursor-col-resize]:last:opacity-0",
                            isModelColumn && "shadow-[inset_-1px_0_0_var(--border)]",
                            header.column.columnDef.meta?.headerClassName,
                          )}
                          data-column-id={header.column.id}
                          style={{
                            width:
                              header.id === "gpu_model"
                                ? "var(--model-column-width)"
                                : header.getSize(),
                            minWidth:
                              header.id === "gpu_model"
                                ? "var(--model-column-width)"
                                : header.column.columnDef.minSize,
                            maxWidth:
                              header.id === "gpu_model"
                                ? "var(--model-column-width)"
                                : undefined,
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
                              onDoubleClick={() => header.column.resetSize()}
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
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
                {isLoading || (isFetching && !data.length) ? (
                  <RowSkeletons
                    table={table}
                    rows={skeletonRowCount}
                    modelColumnWidth={modelColumnWidth}
                  />
                ) : rows.length ? (
                  <>
                    {/* Fallback: render all rows if virtualization is disabled or no virtual items */}
                    {virtualItems.length === 0 ? (
                      <>
                        {rows.map((row, index) => {
                          const triggerOffset = isMobile ? 8 : 15;
                          const triggerIndex = Math.max(0, rows.length - triggerOffset);
                          const shouldAttachSentinel =
                            hasNextPage && index === triggerIndex;

                          return (
                            <React.Fragment key={row.id}>
                              <MemoizedRow
                                row={row}
                                table={table}
                                selected={row.getIsSelected()}
                                checked={checkedRows[row.id] ?? false}
                                modelColumnWidth={modelColumnWidth}
                                data-index={index}
                              />
                              {shouldAttachSentinel ? (
                                <TableRow ref={sentinelRef} aria-hidden>
                                  <TableCell colSpan={columns.length} className="p-0" />
                                </TableRow>
                              ) : null}
                            </React.Fragment>
                          );
                        })}
                      </>
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

                          // Trigger earlier on mobile (smaller screens) to prevent bottoming out
                          const triggerOffset = isMobile ? 8 : 15;
                          const triggerIndex = Math.max(0, rows.length - triggerOffset);
                          const shouldAttachSentinel =
                            hasNextPage && virtualItem.index === triggerIndex;

                          return (
                            <React.Fragment key={virtualItem.key}>
                              <MemoizedRow
                                row={row}
                                table={table}
                                selected={row.getIsSelected()}
                                checked={checkedRows[row.id] ?? false}
                                modelColumnWidth={modelColumnWidth}
                                data-index={virtualItem.index}
                                ref={rowVirtualizer.measureElement}
                              />
                              {shouldAttachSentinel ? (
                                <TableRow ref={sentinelRef} aria-hidden>
                                  <TableCell colSpan={columns.length} className="p-0" />
                                </TableRow>
                              ) : null}
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
                            : isMobile
                              ? 15
                              : 50
                        }
                        modelColumnWidth={modelColumnWidth}
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
        <MemoizedDataTableSheetContent
          table={table}
          data={selectedRow?.original}
          filterFields={filterFields}
          fields={sheetFields}
          // Memoization can be added later if needed
          // REMINDER: this is used to pass additional data like the `InfiniteQueryMeta`
          metadata={{
            totalRows,
            filterRows,
            totalRowsFetched,
            // REMINDER: includes `currentPercentiles`
            ...meta,
          }}
        />
      </DataTableSheetDetails>
      <CheckedActionsIsland initialFavoriteKeys={(meta as any)?.initialFavoriteKeys} />
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
  modelColumnWidth,
  "data-index": dataIndex,
  ref: measureRef,
}: {
  row: Row<TData>;
  table: TTable<TData>;
  // REMINDER: row.getIsSelected(); - just for memoization
  selected?: boolean;
  // Memoize checked highlight without forcing full row rerender otherwise
  checked?: boolean;
  modelColumnWidth: string;
  "data-index"?: number;
  ref?: React.Ref<HTMLTableRowElement>;
}) {
  const canHover =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches
      ? true
      : undefined;

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
        "group/model-row relative [&>:not(:last-child)]:border-r",
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
        const isModelColumn = cell.column.id === "gpu_model";
        return (
          <TableCell
            key={cell.id}
            onClick={isCheckboxCell ? stopPropagation : undefined}
            onMouseDown={isCheckboxCell ? stopPropagation : undefined}
            onPointerDown={isCheckboxCell ? stopPropagation : undefined}
            onKeyDown={isCheckboxCell ? stopPropagation : undefined}
            className={cn(
              "truncate border-b border-border p-[12px] transition-colors",
              isCheckboxCell && "cursor-default hover:cursor-default",
              isModelColumn &&
                cn(
                  "bg-background shadow-[inset_-1px_0_0_var(--border)]",
                  canHover && "group-hover/model-row:bg-muted group-focus-visible/model-row:bg-muted group-data-[state=selected]/model-row:bg-muted group-data-[checked=checked]/model-row:bg-muted",
                  !canHover && selected && "bg-muted",
                  !canHover && checked && "bg-muted",
                ),
              cell.column.columnDef.meta?.cellClassName,
            )}
            style={{
              width:
                cell.column.id === "gpu_model"
                  ? modelColumnWidth
                  : cell.column.getSize(),
              minWidth:
                cell.column.id === "gpu_model"
                  ? modelColumnWidth
                  : cell.column.columnDef.minSize,
              maxWidth:
                cell.column.id === "gpu_model"
                  ? modelColumnWidth
                  : undefined,
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
    prev.modelColumnWidth === next.modelColumnWidth &&
    prev["data-index"] === next["data-index"],
) as typeof Row;
