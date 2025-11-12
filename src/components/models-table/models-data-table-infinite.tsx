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
import { modelsSearchParamsParser } from "./models-search-params";
import { RowSkeletons } from "../infinite-table/_components/row-skeletons";
import { ModelsCheckedActionsIsland } from "./models-checked-actions-island";
import type { ModalitiesDirection } from "./modalities-filter";
import { filterFields, sheetFields } from "./models-constants";
import { UserMenu, type AccountUser } from "../infinite-table/account-components";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { DesktopNavTabs, type DesktopNavItem } from "./nav-tabs";
import type { ModelFavoriteKey } from "@/types/model-favorites";
import { useMediaQuery } from "@/hooks/use-media-query";
const LazyModelSheetCharts = React.lazy(() =>
  import("./model-sheet-charts").then((module) => ({
    default: module.ModelSheetCharts,
  })),
);
import type { ModelsColumnSchema } from "./models-schema";

const noop = () => {};
const gradientSurfaceClass =
  "border border-border bg-gradient-to-b from-muted/70 via-muted/40 to-background text-foreground";

// Note: chart groupings could be added later if needed
export type ModelsDataTableMeta<TMeta> = TMeta & {
  facets?: Record<string, any>;
  initialFavoriteKeys?: ModelFavoriteKey[];
};

export interface ModelsDataTableInfiniteProps<TData, TValue, TMeta> {
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
  meta: ModelsDataTableMeta<TMeta>;
  isFetching?: boolean;
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  fetchNextPage: (
    options?: FetchNextPageOptions | undefined,
  ) => Promise<unknown>;
  renderSheetTitle: (props: { row?: Row<TData> }) => React.ReactNode;
  modelsSearchParamsParser: Record<string, ParserBuilder<any>>;
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
}

export function ModelsDataTableInfinite<TData, TValue, TMeta>({
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
  modelsSearchParamsParser,
  focusTargetRef,
  account,
  headerSlot,
  mobileHeaderOffset,
}: ModelsDataTableInfiniteProps<TData, TValue, TMeta>) {
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
  // modelsSearchParamsParser is provided as a prop
  const [_, setSearch] = useQueryStates(modelsSearchParamsParser);
  const accountUser: AccountUser | null = account?.user ?? null;
  const accountOnSignOut = account?.onSignOut ?? noop;
  const accountIsSigningOut = account?.isSigningOut ?? false;
  const accountOnSignIn = account?.onSignIn;
  const accountOnSignUp = account?.onSignUp;
  const accountIsLoading = account?.isLoading ?? false;
  const pathname = usePathname() ?? "";
  const [isDesktopSearchOpen, setIsDesktopSearchOpen] = React.useState(false);
  // Use proper media query hook for SSR-safe mobile detection
  const isMobile = useMediaQuery("(max-width: 639px)");
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
  }, [data.length, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, isPrefetching]);

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
      // Try to extract ID from row object
      if (
        originalRow &&
        typeof originalRow === "object" &&
        "id" in (originalRow as Record<string, unknown>)
      ) {
        const rawId = (originalRow as Record<string, unknown>).id;
        if (typeof rawId === "string" && rawId.trim().length > 0) {
          return rawId;
        }
        if (typeof rawId === "number" && !isNaN(rawId)) {
          return String(rawId);
        }
      }

      // Try to extract slug or uuid as fallback (common in models data)
      if (originalRow && typeof originalRow === "object") {
        const rowRecord = originalRow as Record<string, unknown>;
        if ("slug" in rowRecord && typeof rowRecord.slug === "string" && rowRecord.slug.trim().length > 0) {
          return rowRecord.slug;
        }
        if ("uuid" in rowRecord) {
          const uuid = rowRecord.uuid;
          if (typeof uuid === "string" && uuid.trim().length > 0) {
            return uuid;
          }
          if (typeof uuid === "number" && !isNaN(uuid)) {
            return String(uuid);
          }
        }
      }

      // Only warn in development, and only once
      if (process.env.NODE_ENV !== "production" && !missingRowIdWarningRef.current) {
        missingRowIdWarningRef.current = true;
        console.warn(
          "[ModelsDataTableInfinite] Falling back to index-based row ids. " +
            "This may cause favorites to break. Pass `getRowId` or ensure each row has a stable `id`, `slug`, or `uuid` field.",
          { row: originalRow, index },
        );
      }

      // Last resort: use index (not ideal but prevents crashes)
      return `__index_${index}`;
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
        "name",
        "inputPrice",
        "outputPrice",
        "contextLength",
        "maxCompletionTokens",
        "mmlu",
        "inputModalities",
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
  // Keep virtualization enabled even during loading to prevent layout shifts
  // When disabled, it will fall back to rendering all rows, which is fine for empty/loading states
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 37, // Row height in pixels
    overscan: isMobile ? 25 : 50, // Mobile: 25, Desktop: 50 extra rows above/below viewport
    enabled: rows.length > 0, // Only disable when there are no rows to render
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

  const modelColumnMeasuredWidthRef = React.useRef<number | null>(null);
  // Track if model column has been manually resized - persists across renders
  // Once resized, column should always use pixel width (never revert to "auto")
  const modelColumnHasBeenResizedRef = React.useRef<boolean>(false);
  
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

    const headerElement = getHeaderRef("name").current;
    if (!headerElement) {
      return;
    }

    const updateMeasuredWidth = (width?: number) => {
      if (!width || Number.isNaN(width)) {
        return;
      }
      modelColumnMeasuredWidthRef.current = width;
    };

    // Capture the initial rendered width (auto) before we ever enter the resize handler.
    updateMeasuredWidth(headerElement.getBoundingClientRect().width || headerElement.offsetWidth);

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
    const handleResize = () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
      frame = window.requestAnimationFrame(() => {
        updateMeasuredWidth(headerElement.getBoundingClientRect().width || headerElement.offsetWidth);
      });
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (frame) {
        cancelAnimationFrame(frame);
      }
    };
  }, [getHeaderRef]);

  const minimumModelColumnWidth = React.useMemo(
    () => table.getColumn("name")?.columnDef.minSize ?? 270,
    [table]
  );
  const modelColumnDefaultSize = React.useMemo(
    () => table.getColumn("name")?.columnDef.size ?? 305,
    [table]
  );
  
  // Helper to check if model column has been manually resized
  const isModelColumnResized = React.useCallback((columnId: string) => {
    if (columnId !== "name") return false;
    const columnSizing = table.getState().columnSizing;
    // Check both TanStack state and our persistent flag
    return columnId in columnSizing || modelColumnHasBeenResizedRef.current;
  }, [table]);
  
  // Helper to get model column width style
  const getModelColumnWidth = React.useCallback((columnId: string, currentSize: number) => {
    if (columnId !== "name") {
      return `${currentSize}px`;
    }
    
    // Once resized, always use pixel width (prevents jumping when hitting min size)
    if (modelColumnHasBeenResizedRef.current) {
      return `${currentSize}px`;
    }
    
    // Use "auto" for flex growth only when never resized and at default size
    return currentSize === modelColumnDefaultSize ? "auto" : `${currentSize}px`;
  }, [modelColumnDefaultSize]);
  const fixedColumnsWidth = React.useMemo(
    () =>
      table
        .getVisibleLeafColumns()
        .filter((column) => column.id !== "name")
        .reduce((acc, column) => acc + column.getSize(), 0),
    [table]
  );

  const previousSearchPayloadRef = React.useRef<string>("");

  React.useEffect(() => {
    const searchPayload: Record<string, unknown> = {};

    filterFields.forEach((field) => {
      if (field.value === "modalities") {
        const modalitiesFilter = columnFilters.find((filter) => filter.id === field.value);
        const modalityValue = modalitiesFilter?.value as string[] | undefined;
        const values = modalityValue ?? [];

        const directionsFilter = columnFilters.find((filter) => filter.id === "modalityDirections");
        const directionsValue = directionsFilter?.value as Record<string, ModalitiesDirection> | undefined;
        const directionEntries = directionsValue
          ? Object.entries(directionsValue)
              .map(([key, dir]) => `${key}:${dir}`)
              .sort()
          : [];

        searchPayload[field.value as string] = values.length ? values : null;
        searchPayload.modalityDirections = values.length && directionEntries.length ? directionEntries : null;
        return;
      }

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

  const selectedModel = selectedRow?.original as Partial<ModelsColumnSchema> | undefined;

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
              <div className="mx-auto w-full max-w-full pl-4 pr-0 pt-4 mb-4 space-y-4">
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
                <div className="mx-auto w-full max-w-full pl-4 pr-0 py-0">
                  <DataTableFilterControls showSearch={false} />
                </div>
              </div>
              <div className="flex-shrink-0 p-0">
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
                  "border-0 md:border-l bg-background overflow-hidden flex-1 min-h-0 flex flex-col"
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
                      className={cn(
                        "bg-muted",
                        "[&>:not(:last-child)]:border-r",
                      )}
                    >
                    {headerGroup.headers.map((header) => {
                      const isModelColumn = header.id === "name";
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

                        const columnSizing = table.getState().columnSizing;
                        const hasBeenResized = header.id in columnSizing || modelColumnHasBeenResizedRef.current;

                        if (!hasBeenResized && header.getSize() === modelColumnDefaultSize) {
                          modelColumnHasBeenResizedRef.current = true;

                          const measuredWidth = modelColumnMeasuredWidthRef.current ?? header.getSize();
                          const widthToSet =
                            measuredWidth && measuredWidth > 0
                              ? Math.max(measuredWidth, minimumModelColumnWidth)
                              : minimumModelColumnWidth;

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
                              return;
                            }
                            handler(syntheticEvent);
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
                              header.id === "name"
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
                {isLoading || (isFetching && !data.length) ? (
                  <RowSkeletons
                    table={table}
                    rows={skeletonRowCount}
                    modelColumnWidth={`${minimumModelColumnWidth}px`}
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
                                data-index={virtualItem.index}
                                ref={rowVirtualizer.measureElement}
                                getModelColumnWidth={getModelColumnWidth}
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
                        modelColumnWidth={`${minimumModelColumnWidth}px`}
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
      {/** Selected row metadata for sheet charts */}
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
            metadata={{
              totalRows,
              filterRows,
              totalRowsFetched,
              // REMINDER: includes `currentPercentiles`
              ...meta,
            }}
          />
          {selectedModel?.permaslug && selectedModel?.endpointId ? (
            <React.Suspense
              fallback={
                <div className="grid gap-4">
                  <div className="h-36 animate-pulse rounded-lg bg-muted" />
                  <div className="h-36 animate-pulse rounded-lg bg-muted" />
                </div>
              }
            >
              <LazyModelSheetCharts
                permaslug={selectedModel.permaslug}
                endpointId={selectedModel.endpointId}
                provider={selectedModel?.provider}
              />
            </React.Suspense>
          ) : null}
        </div>
      </DataTableSheetDetails>
      <ModelsCheckedActionsIsland initialFavoriteKeys={(meta as any)?.initialFavoriteKeys} />
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
}) {
  const canHover =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches
      ? true
      : undefined;

  const minimumModelColumnWidth =
    table.getColumn("name")?.columnDef.minSize ?? 270;
  const modelColumnDefaultSize =
    table.getColumn("name")?.columnDef.size ?? 305;

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
        const isModelColumn = cell.column.id === "name";
        return (
          <TableCell
            key={cell.id}
            data-column-id={cell.column.id}
            onClick={isCheckboxCell ? stopPropagation : undefined}
            onMouseDown={isCheckboxCell ? stopPropagation : undefined}
            onPointerDown={isCheckboxCell ? stopPropagation : undefined}
            onKeyDown={isCheckboxCell ? stopPropagation : undefined}
            className={cn(
              "truncate border-b border-border px-[12px] py-[8px] transition-colors",
              isCheckboxCell && "cursor-default hover:cursor-default",
              cell.column.columnDef.meta?.cellClassName,
            )}
            style={{
              width: getModelColumnWidth 
                ? getModelColumnWidth(cell.column.id, cell.column.getSize())
                : `${cell.column.getSize()}px`,
              minWidth:
                cell.column.id === "name"
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
    prev["data-index"] === next["data-index"],
) as typeof Row;
