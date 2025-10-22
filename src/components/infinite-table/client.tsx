"use client";

import { useHotKey } from "@/hooks/use-hot-key";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ColumnFiltersState,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";
import { useQueryStates } from "nuqs";
import * as React from "react";
import { columns } from "./columns";
import { filterFields as defaultFilterFields, sheetFields } from "./constants";
import { DataTableInfinite } from "./data-table-infinite";
import { dataOptions } from "./query-options";
import { searchParamsParser } from "./search-params";
import type { RowWithId } from "@/types/api";
import type { ColumnSchema } from "./schema";
import { stableGpuKey } from "./stable-key";
// Inline notices handle favorites feedback; no toasts here.
import type { FavoriteKey } from "@/types/favorites";
import { 
  FAVORITES_QUERY_KEY, 
  FAVORITES_BROADCAST_CHANNEL,
} from "@/lib/favorites/constants";
import { getFavorites } from "@/lib/favorites/api-client";

interface ClientProps {
  initialFavoritesData?: ColumnSchema[];
  initialFavoriteKeys?: string[];
}

export function Client({ initialFavoritesData, initialFavoriteKeys }: ClientProps = {}) {
  const contentRef = React.useRef<HTMLTableSectionElement>(null);
  const [search] = useQueryStates(searchParamsParser);
  const queryClient = useQueryClient();

  // Use favorites data if provided, otherwise use infinite query
  const isFavoritesMode = !!initialFavoritesData;

  /**
   * Initialize query cache with SSR data if available
   * Only runs once on mount to avoid overwriting optimistic updates
   */
  const initializedRef = React.useRef(false);
  React.useEffect(() => {
    if (!initializedRef.current && initialFavoriteKeys) {
      queryClient.setQueryData(FAVORITES_QUERY_KEY, initialFavoriteKeys);
      initializedRef.current = true;
    }
  }, [initialFavoriteKeys, queryClient]);

  /**
   * Subscribe to cache updates without fetching
   * In favorites mode, never fetches - only listens to cache changes from optimistic updates
   * Uses centralized API client with timeout and error handling
   */
  const { data: favorites = [], isError: isFavoritesError, error: favoritesError } = useQuery({
    queryKey: FAVORITES_QUERY_KEY,
    queryFn: getFavorites,
    staleTime: Infinity,
    enabled: false, // Never auto-fetch in this component (CheckedActionsIsland handles fetching)
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  /**
   * Cross-tab synchronization for favorites view
   * Receives favorites data directly from other tabs (no API call)
   * This optimizes multi-tab scenarios by avoiding redundant server requests
   */
  React.useEffect(() => {
    if (!isFavoritesMode) return;
    const bc = new BroadcastChannel(FAVORITES_BROADCAST_CHANNEL);
    bc.onmessage = (event) => {
      if (event.data?.type === "updated" && Array.isArray(event.data?.favorites)) {
        const newFavorites = event.data.favorites as FavoriteKey[];
        queryClient.setQueryData(FAVORITES_QUERY_KEY, newFavorites);
      }
    };
    return () => bc.close();
  }, [isFavoritesMode, queryClient]);

  // Removed old Sonner error toasts here (query is disabled in this component)

  /**
   * Convert favorites array to Set for O(1) lookup performance
   * Used for filtering table data and checking favorite status
   */
  const favoriteKeys = React.useMemo(() => new Set(favorites as FavoriteKey[]), [favorites]);

  /**
   * Track filtered favorites data for favorites view
   * Updates reactively when user favorites/unfavorites items
   */
  const [favoritesData, setFavoritesData] = React.useState(initialFavoritesData);

  // Update favorites data when initialFavoritesData changes (SSR navigation)
  React.useEffect(() => {
    setFavoritesData(initialFavoritesData);
  }, [initialFavoritesData]);

  /**
   * Reactively filter favorites data based on current favorite keys
   * Enables instant row removal in favorites view when items are unfavorited
   */
  React.useEffect(() => {
    if (isFavoritesMode && initialFavoritesData && !isFavoritesError) {
      const updatedFavoritesData = initialFavoritesData.filter(row =>
        favoriteKeys.has(stableGpuKey(row))
      );
      setFavoritesData(updatedFavoritesData);
    }
  }, [favorites, favoriteKeys, isFavoritesMode, initialFavoritesData, isFavoritesError]);

  const {
    data,
    isFetching,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    ...dataOptions(search),
    enabled: !isFavoritesMode, // Disable infinite query when showing favorites
  });

  useHotKey(() => {
    contentRef.current?.focus();
  }, ".");

  const flatData: RowWithId[] = React.useMemo(() => {
    if (isFavoritesMode) {
      // Use favorites data with optimistic updates
      return (favoritesData || initialFavoritesData || []) as RowWithId[];
    }
    // Server guarantees stable, non-overlapping windows via deterministic sort + cursor
    return (data?.pages?.flatMap((page) => page.data ?? []) as RowWithId[]) ?? [] as RowWithId[];
  }, [data?.pages, isFavoritesMode, favoritesData, initialFavoritesData]);

  // REMINDER: meta data is always the same for all pages as filters do not change(!)
  const lastPage = data?.pages?.[data?.pages.length - 1];
  const totalDBRowCount = isFavoritesMode ? flatData.length : lastPage?.meta?.totalRowCount;
  const filterDBRowCount = isFavoritesMode ? flatData.length : lastPage?.meta?.filterRowCount;
  const metadata = {
    ...(lastPage?.meta?.metadata ?? {}),
    initialFavoriteKeys,
  } as Record<string, unknown>;
  const facets = isFavoritesMode ? {} : lastPage?.meta?.facets;
  const totalFetched = flatData?.length;

  const { sort, start, size, uuid, cursor, direction, observed_at, search: globalSearch, ...filter } =
    search;

  const derivedColumnFilters = React.useMemo<ColumnFiltersState>(() => {
    const baseFilters = Object.entries(filter)
      .map(([key, value]) => ({
        id: key,
        value,
      }))
      .filter(({ value }) => value ?? undefined);

    if (typeof globalSearch === "string" && globalSearch.trim().length) {
      baseFilters.push({ id: "search", value: globalSearch });
    }

    return baseFilters;
  }, [filter, globalSearch]);

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    derivedColumnFilters,
  );
  const derivedColumnFiltersRef =
    React.useRef<ColumnFiltersState>(derivedColumnFilters);

  React.useEffect(() => {
    if (
      !areColumnFiltersEqual(
        derivedColumnFiltersRef.current,
        derivedColumnFilters,
      )
    ) {
      setColumnFilters(derivedColumnFilters);
    }
    derivedColumnFiltersRef.current = derivedColumnFilters;
  }, [derivedColumnFilters]);

  const derivedSorting = React.useMemo<SortingState>(() => {
    return sort ? [sort] : [];
  }, [sort]);

  const [sorting, setSorting] = React.useState<SortingState>(derivedSorting);
  const derivedSortingRef = React.useRef<SortingState>(derivedSorting);

  // Scroll to top when sorting changes to prevent stale data flashing
  React.useEffect(() => {
    if (sorting.length > 0) {
      // Scroll to top when sorting changes to show fresh sorted data
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [sorting]);

  React.useEffect(() => {
    if (!isSortingStateEqual(derivedSortingRef.current, derivedSorting)) {
      setSorting(derivedSorting);
    }
    derivedSortingRef.current = derivedSorting;
  }, [derivedSorting]);

  const derivedRowSelection = React.useMemo<RowSelectionState>(() => {
    return search.uuid ? { [search.uuid]: true } : {};
  }, [search.uuid]);

  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>(
    derivedRowSelection,
  );
  const derivedRowSelectionRef =
    React.useRef<RowSelectionState>(derivedRowSelection);

  React.useEffect(() => {
    if (
      !isRowSelectionEqual(derivedRowSelectionRef.current, derivedRowSelection)
    ) {
      setRowSelection(derivedRowSelection);
    }
    derivedRowSelectionRef.current = derivedRowSelection;
  }, [derivedRowSelection]);

  // REMINDER: this is currently needed for the cmdk search
  // TODO: auto search via API when the user changes the filter instead of hardcoded
  const filterFields = React.useMemo(() => {
    return defaultFilterFields.map((field) => {
      const facetsField = facets?.[field.value];
      if (!facetsField) return field;
      if (field.options && field.options.length > 0) return field;

      // REMINDER: if no options are set, we need to set them via the API
    const options = facetsField.rows.map(({ value }) => {
      return {
        label: `${value}`,
        value,
      };
    });

    if (field.type === "slider") {
      return {
        ...field,
        min: facetsField.min ?? field.min,
        max: facetsField.max ?? field.max,
        options, // Use API-generated options for sliders
      };
    }

    // Only set options for checkbox fields, not input fields
    if (field.type === "checkbox") {
      return { ...field, options };
    }

    return field;
    });
  }, [facets]);

  return (
      <DataTableInfinite
      key={`table-${isFavoritesMode ? `favorites-${favorites?.length || 0}` : 'all'}`}
      columns={columns}
      data={flatData}
        skeletonRowCount={search.size ?? 50}
      totalRows={totalDBRowCount}
      filterRows={filterDBRowCount}
      totalRowsFetched={totalFetched}
      columnFilters={columnFilters}
      onColumnFiltersChange={setColumnFilters}
      sorting={sorting}
      onSortingChange={setSorting}
      rowSelection={rowSelection}
      onRowSelectionChange={setRowSelection}
      meta={{
        ...metadata,
        facets,
        totalRows: totalDBRowCount ?? 0,
        filterRows: filterDBRowCount ?? 0,
        totalRowsFetched: totalFetched ?? 0,
      }}
      filterFields={filterFields}
      sheetFields={sheetFields}
      isFetching={isFavoritesMode ? false : isFetching}
      isLoading={isFavoritesMode ? false : isLoading}
      isFetchingNextPage={isFavoritesMode ? false : isFetchingNextPage}
      fetchNextPage={isFavoritesMode ? () => Promise.resolve() : fetchNextPage}
      hasNextPage={isFavoritesMode ? false : hasNextPage}
      getRowClassName={() => "opacity-100"}
      getRowId={(row) => row.uuid}
      renderSheetTitle={(props) => props.row?.original.uuid}
      searchParamsParser={searchParamsParser}
      focusTargetRef={contentRef}
    />
  );
}


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

function isSortingStateEqual(a: SortingState, b: SortingState) {
  if (a.length !== b.length) return false;
  return a.every((entry, index) => {
    const other = b[index];
    if (!other) return false;
    return entry.id === other.id && entry.desc === other.desc;
  });
}

function isRowSelectionEqual(a: RowSelectionState, b: RowSelectionState) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => Boolean(a[key]) === Boolean(b[key]));
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
