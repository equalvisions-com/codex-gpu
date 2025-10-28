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
import { MemoizedDataTableSheetContent } from "@/components/data-table/data-table-sheet/data-table-sheet-content";
import { DataTableSheetDetails } from "@/components/data-table/data-table-sheet/data-table-sheet-details";
import type {
  DataTableFilterField,
  SheetField,
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
import { useQueryStates, type ParserBuilder } from "nuqs";
import { modelsSearchParamsParser } from "./models-search-params";
import { RowSkeletons } from "../infinite-table/_components/row-skeletons";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ModelsCheckedActionsIsland } from "./models-checked-actions-island";
import type { ModalitiesDirection } from "./modalities-filter";
import { filterFields, sheetFields } from "./models-constants";

const noop = () => {};
import { SidebarPanel, type AccountUser } from "../infinite-table/account-components";

// FloatingControlsButton removed


// Note: chart groupings could be added later if needed
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
  meta: TMeta & { facets?: Record<string, any> };
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

  const onScroll = React.useCallback(
    (e: React.UIEvent<HTMLElement>) => {
      const onPageBottom =
        Math.ceil(e.currentTarget.scrollTop + e.currentTarget.clientHeight) >=
        e.currentTarget.scrollHeight;

      if (onPageBottom && !isFetching && hasNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, isFetching, hasNextPage],
  );

  // IntersectionObserver sentinel for near-bottom prefetch
  const sentinelRef = React.useCallback((node: HTMLTableRowElement | null) => {
    if (!node) return;
    const root = (containerRef.current ?? undefined);
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasNextPage && !isFetching) {
          fetchNextPage();
        }
      },
      { root, rootMargin: "600px 0px 0px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [containerRef, fetchNextPage, hasNextPage, isFetching]);


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
    getRowId,
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


  // Virtualizer
  const rows = table.getRowModel().rows;
  const containerVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 45,
    getItemKey: (index) => rows[index]?.id ?? index,
    overscan: 40,
  });
  const rowVirtualizer = containerVirtualizer;

  const columnSizingState = table.getState().columnSizing;
  const minimumModelColumnWidth =
    table.getColumn("name")?.columnDef.minSize ?? 250;
  const fixedColumnsWidth = React.useMemo(() => {
    return table
      .getVisibleLeafColumns()
      .filter((column) => column.id !== "name")
      .reduce((acc, column) => acc + column.getSize(), 0);
  }, [table, columnSizingState]);

  const effectiveFixedColumnsWidth = fixedColumnsWidth;

  const modelColumnWidthValue = React.useMemo(() => {
    return `max(${minimumModelColumnWidth}px, calc(100% - ${effectiveFixedColumnsWidth}px))`;
  }, [minimumModelColumnWidth, effectiveFixedColumnsWidth]);

  const tableWidthStyle = React.useMemo(
    () =>
      ({
        width: "100%",
        minWidth: `${effectiveFixedColumnsWidth + minimumModelColumnWidth}px`,
        "--model-column-width": modelColumnWidthValue,
      }) as React.CSSProperties,
    [effectiveFixedColumnsWidth, minimumModelColumnWidth, modelColumnWidthValue],
  );

  // Calculated width value for model column styling
  const modelColumnWidth = modelColumnWidthValue;

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

  React.useEffect(() => {
    setSearch({ sort: sorting?.[0] || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorting]);

  // Reset virtualizer when sorting changes to prevent flickering
  React.useEffect(() => {
    // Reset measurements and scroll to top for fresh sorted data
    containerVirtualizer.measure();
    containerVirtualizer.scrollToIndex(0, { align: 'start' });
  }, [sorting, containerVirtualizer]);

  const selectedRow = React.useMemo(() => {
    if ((isLoading || isFetching) && !data.length) return;
    const selectedRowKey = Object.keys(rowSelection)?.[0];
    return table
      .getCoreRowModel()
      .flatRows.find((row) => row.id === selectedRowKey);
  }, [rowSelection, table, isLoading, isFetching, data]);

  // Selection sync limited to the current batch
  React.useEffect(() => {
    if (isLoading || isFetching) return;
    if (Object.keys(rowSelection)?.length && !selectedRow) {
      setSearch({ uuid: null });
      onRowSelectionChange({});
    } else {
      setSearch({ uuid: Object.keys(rowSelection)?.[0] || null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowSelection, selectedRow, isLoading, isFetching, onRowSelectionChange]);


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
      <div className="flex flex-col gap-4">
        {headerSlot}
        <div className="grid h-full grid-cols-1 gap-6 sm:grid-cols-[13rem_1fr] md:grid-cols-[18rem_1fr]">
          <div
            className={cn(
              "hidden sm:flex h-[calc(100dvh-var(--total-padding-mobile))] sm:h-[calc(100dvh-var(--total-padding-desktop))] flex-col sticky top-0 min-w-52 max-w-52 self-start md:min-w-72 md:max-w-72 rounded-lg border bg-background overflow-hidden"
            )}
          >
            <SidebarPanel
              user={accountUser}
              onSignOut={accountOnSignOut}
              isSigningOut={accountIsSigningOut}
            />
          </div>
          <div
            className={cn(
              "flex max-w-full flex-1 flex-col min-w-0"
            )}
            data-table-container=""
          >
            <div className="z-0">
              <div
                className={cn(
                  mobileHeightClass,
                  "sm:h-[calc(100dvh-var(--total-padding-desktop))] rounded-none sm:rounded-lg border bg-background overflow-hidden"
                )}
                style={mobileHeightStyle}
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
                    "h-full overscroll-x-none scrollbar-hide"
                  )}
                >
              <TableHeader className={cn("sticky top-0 z-50 bg-[#f8fafc] dark:bg-[#090909]")}>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className={cn(
                      "bg-[#f8fafc] dark:bg-[#090909]",
                      "[&>:not(:last-child)]:border-r",
                    )}
                  >
                    {headerGroup.headers.map((header) => {
                      const isModelColumn = header.id === "name";
                      return (
                        <TableHead
                          key={header.id}
                          className={cn(
                            "relative select-none truncate border-b border-border bg-[#f8fafc] dark:bg-[#090909] text-foreground/70 [&>.cursor-col-resize]:last:opacity-0",
                            isModelColumn && "shadow-[inset_-1px_0_0_var(--border)]",
                            header.column.columnDef.meta?.headerClassName,
                          )}
                          data-column-id={header.column.id}
                          style={{
                            width:
                              header.id === "name"
                                ? "var(--model-column-width)"
                                : header.getSize(),
                            minWidth:
                              header.id === "name"
                                ? "var(--model-column-width)"
                                : header.column.columnDef.minSize,
                            maxWidth:
                              header.id === "name"
                                ? "var(--model-column-width)"
                                : undefined,
                            ...(isModelColumn
                              ? {
                                  position: "sticky",
                                  left: 0,
                                  top: 0,
                                  zIndex: 60,
                                }
                              : {}),
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
                    modelColumnWidth="var(--model-column-width)"
                  />
                ) : table.getRowModel().rows?.length ? (
                  <React.Fragment>
                    {(() => {
                      const virtualRows = rowVirtualizer.getVirtualItems();
                      const totalSize = rowVirtualizer.getTotalSize();
                      const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
                      const paddingBottom = virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0;
                      return (
                        <React.Fragment>
                          {paddingTop > 0 && (
                            <TableRow aria-hidden>
                              <TableCell colSpan={columns.length} style={{ height: paddingTop }} />
                            </TableRow>
                          )}
                          {virtualRows.map((vRow) => {
                            const row = rows[vRow.index];
                            return (
                              <React.Fragment key={row.id}>
                                <MemoizedRow
                                  dataIndex={vRow.index}
                                  row={row}
                                  table={table}
                                  selected={row.getIsSelected()}
                                  checked={checkedRows[row.id] ?? false}
                                  modelColumnWidth="var(--model-column-width)"
                                  rowRef={rowVirtualizer.measureElement}
                                />
                              </React.Fragment>
                            );
                          })}
                          {paddingBottom > 0 && (
                            <TableRow aria-hidden>
                              <TableCell colSpan={columns.length} style={{ height: paddingBottom }} />
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })()}
                    {/* Sentinel row for prefetch */}
                    <TableRow ref={sentinelRef} aria-hidden />
                    {(isFetchingNextPage && hasNextPage) && (
                      <RowSkeletons
                        table={table}
                        rows={
                          typeof skeletonNextPageRowCount === "number"
                            ? skeletonNextPageRowCount
                            : skeletonRowCount
                        }
                        modelColumnWidth="var(--model-column-width)"
                      />
                    )}
                  </React.Fragment>
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
  rowRef,
  dataIndex,
  modelColumnWidth,
}: {
  row: Row<TData>;
  table: TTable<TData>;
  // REMINDER: row.getIsSelected(); - just for memoization
  selected?: boolean;
  // Memoize checked highlight without forcing full row rerender otherwise
  checked?: boolean;
  // Used by the virtualizer to dynamically measure row height
  rowRef?: (el: HTMLTableRowElement | null) => void;
  // Virtual index for measurement mapping
  dataIndex?: number;
  modelColumnWidth: string;
}) {
  return (
    <TableRow
      ref={rowRef}
      data-index={dataIndex}
      id={row.id}
      data-can-hover={typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches ? true : undefined}
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
        "transition-colors focus-visible:bg-muted/70 data-[checked=checked]:bg-muted/70 hover:cursor-pointer",
        table.options.meta?.getRowClassName?.(row),
      )}
    >
      {row.getVisibleCells().map((cell) => {
        const isCheckboxCell = cell.column.id === "blank";
        const stopPropagation = (e: any) => {
          e.stopPropagation();
        };
        const isModelColumn = cell.column.id === "name";
        const stickyBackground =
          isModelColumn && (selected || checked)
            ? "hsl(var(--muted) / 0.7)"
            : undefined;
        return (
          <TableCell
            key={cell.id}
            onClick={isCheckboxCell ? stopPropagation : undefined}
            onMouseDown={isCheckboxCell ? stopPropagation : undefined}
            onPointerDown={isCheckboxCell ? stopPropagation : undefined}
            onKeyDown={isCheckboxCell ? stopPropagation : undefined}
            className={cn(
              "truncate border-b border-border p-[12px]",
              isCheckboxCell && "cursor-default hover:cursor-default",
              isModelColumn &&
                "bg-background shadow-[inset_-1px_0_0_var(--border)] group-hover/model-row:bg-muted/70 group-focus-visible/model-row:bg-muted/70",
              cell.column.columnDef.meta?.cellClassName,
            )}
            style={{
              width:
                cell.column.id === "name"
                  ? modelColumnWidth
                  : cell.column.getSize(),
              minWidth:
                cell.column.id === "name"
                  ? modelColumnWidth
                  : cell.column.columnDef.minSize,
              maxWidth:
                cell.column.id === "name"
                  ? modelColumnWidth
                  : undefined,
              ...(isModelColumn
                ? {
                    position: "sticky",
                    left: 0,
                    zIndex: 40,
                    ...(stickyBackground ? { backgroundColor: stickyBackground } : {}),
                  }
                : {}),
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
    prev.selected === next.selected &&
    prev.checked === next.checked &&
    prev.modelColumnWidth === next.modelColumnWidth,
) as typeof Row;
