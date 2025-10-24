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
import { useAuth } from "@/providers/auth-client-provider";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import {
  LogOut,
  ChevronsUpDown,
  Settings as SettingsIcon,
  Sun,
} from "lucide-react";
import { ModeToggle } from "@/components/theme/toggle-mode";
import { RowSkeletons } from "../infinite-table/_components/row-skeletons";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ModelsCheckedActionsIsland } from "./models-checked-actions-island";
import { DataTableFilterControls } from "../data-table/data-table-filter-controls";
import type { ModalitiesDirection } from "./modalities-filter";
import { filterFields, sheetFields } from "./models-constants";

interface UserMenuProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  onSignOut: () => void;
  isSigningOut: boolean;
}

function UserMenu({ user, onSignOut, isSigningOut }: UserMenuProps) {
  const normalizedName = user.name?.trim();
  const email = user.email ?? "";
  const displayName = normalizedName || email || "Account";
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const hasImage = Boolean(user.image);
  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="flex w-full items-center gap-2 rounded-md p-2 h-auto text-left text-sm font-medium text-foreground hover:bg-muted/50 hover:text-accent-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
            disabled={isSigningOut}
          >
            <div className="relative h-8 w-8">
              {hasImage && !imageLoaded ? (
                <Skeleton className="h-8 w-8 rounded-full" />
              ) : null}
              <Avatar className={cn("h-8 w-8", hasImage && !imageLoaded ? "opacity-0" : "opacity-100")}>
                {hasImage ? (
                  <AvatarImage
                    src={user.image!}
                    alt={displayName}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageLoaded(true)}
                  />
                ) : null}
              </Avatar>
            </div>
            <div className="flex min-w-0 flex-1 flex-col text-left">
              <span className="truncate">{displayName}</span>
              {email ? (
                <span className="truncate text-xs text-muted-foreground">{email}</span>
              ) : null}
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-60">
          <DropdownMenuLabel className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              {user.image ? (
                <AvatarImage src={user.image} alt={displayName} />
              ) : null}
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold">{displayName}</span>
              {email ? (
                <span className="truncate text-xs text-muted-foreground">{email}</span>
              ) : null}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings" className="cursor-pointer flex w-full items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              <span>Settings</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-default focus:bg-transparent focus:text-foreground"
            onSelect={(event) => event.preventDefault()}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                <Sun className="h-4 w-4" />
                <span>Theme</span>
              </div>
              <ModeToggle className="h-8 w-8 [&>svg]:h-4 [&>svg]:w-4" />
            </div>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer"
            onSelect={() => {
              if (!isSigningOut) {
                onSignOut();
              }
            }}
            disabled={isSigningOut}
          >
            <LogOut className="h-4 w-4" />
            <span>{isSigningOut ? "Signing out..." : "Sign out"}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

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

  // User menu functionality
  const { session, signOut } = useAuth();
  const [isSigningOut, startSignOutTransition] = React.useTransition();
  const queryClient = useQueryClient();
  const router = useRouter();

  const handleSignOut = React.useCallback(() => {
    startSignOutTransition(async () => {
      try {
        await signOut();
      } finally {
        queryClient.clear();
        router.replace("/", { scroll: false });
        router.refresh();
      }
    });
  }, [queryClient, router, signOut]);

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
      }) as React.CSSProperties,
    [effectiveFixedColumnsWidth, minimumModelColumnWidth],
  );

  // Calculated width value for model column styling
  const modelColumnWidth = modelColumnWidthValue;

  React.useEffect(() => {
    const hasModalities = columnFilters.some((filter) => filter.id === "modalities");
    const hasDirectionMap = columnFilters.some((filter) => filter.id === "modalityDirections");

    if (!hasModalities && hasDirectionMap) {
      const nextFilters = columnFilters.filter((filter) => filter.id !== "modalityDirections");
      onColumnFiltersChange(nextFilters);
    }
  }, [columnFilters, onColumnFiltersChange]);

  const previousSearchPayloadRef = React.useRef<string>("");

  React.useEffect(() => {
    const searchPayload: Record<string, unknown> = {};

    filterFields.forEach((field) => {
      if (field.value === "modalities") {
        const columnFilter = columnFilters.find((filter) => filter.id === "modalities");
        const values = (columnFilter?.value as string[] | undefined) ?? [];
        searchPayload.modalities = values.length ? values : null;

        const directionsFilter = columnFilters.find((filter) => filter.id === "modalityDirections");
        const directionsValue = directionsFilter?.value as Record<string, ModalitiesDirection> | undefined;
        const directionEntries = directionsValue
          ? Object.entries(directionsValue)
              .map(([key, dir]) => `${key}:${dir}`)
              .sort()
          : [];
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
      <div className="grid h-full grid-cols-1 sm:grid-cols-[13rem_1fr] md:grid-cols-[18rem_1fr] gap-6">
          <div
            className={cn(
              "hidden sm:flex h-[calc(100dvh-var(--total-padding-mobile))] sm:h-[calc(100dvh-var(--total-padding-desktop))] flex-col sticky top-0 min-w-52 max-w-52 self-start md:min-w-72 md:max-w-72 rounded-lg border bg-background overflow-hidden"
            )}
          >
            <div className="relative flex flex-col h-full">
              <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
                <div className="w-full max-w-full mx-auto">
                  <DataTableFilterControls />
                </div>
              </div>
              {session ? (
                <div className="flex-shrink-0 border-t border-border p-2">
                  <UserMenu
                    user={{
                      name: session.user?.name,
                      email: session.user?.email,
                      image: session.user?.image,
                    }}
                    onSignOut={handleSignOut}
                    isSigningOut={isSigningOut}
                  />
                </div>
              ) : null}
            </div>
          </div>
        <div
          className={cn(
            "flex max-w-full flex-1 flex-col min-w-0"
          )}
          data-table-container=""
        >
          <div className="z-0">
            <div className="h-[calc(100dvh-var(--total-padding-mobile))] sm:h-[calc(100dvh-var(--total-padding-desktop))] rounded-lg border bg-background overflow-hidden">
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
              <TableHeader className={cn("sticky top-0 z-20 bg-[#f8fafc] dark:bg-[#090909]")}>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className={cn(
                      "bg-[#f8fafc] dark:bg-[#090909]",
                      "[&>:not(:last-child)]:border-r",
                    )}
                  >
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead
                          key={header.id}
                          className={cn(
                            "relative select-none truncate border-b border-border bg-[#f8fafc] dark:bg-[#090909] text-foreground/70 [&>.cursor-col-resize]:last:opacity-0",
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
        "[&>:not(:last-child)]:border-r",
        "transition-colors focus-visible:bg-muted/50 data-[checked=checked]:bg-muted/50 hover:cursor-pointer",
        table.options.meta?.getRowClassName?.(row),
      )}
    >
      {row.getVisibleCells().map((cell) => {
        const isCheckboxCell = cell.column.id === "blank";
        const stopPropagation = (e: any) => {
          e.stopPropagation();
        };
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
