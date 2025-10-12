"use client";

import { useHotKey } from "@/hooks/use-hot-key";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ColumnFiltersState,
  RowSelectionState,
  SortingState,
  Table as TTable,
} from "@tanstack/react-table";
import { useQueryStates } from "nuqs";
import * as React from "react";
import { cpuColumns } from "./cpu-columns";
import { cpuFilterFields, cpuSheetFields } from "./cpu-constants";
import { CpuDataTableInfinite } from "./cpu-data-table-infinite";
import { cpuDataOptions } from "./cpu-query-options";
import type { CpuFacetMetadataSchema } from "./cpu-schema";
import { cpuSearchParamsParser } from "./cpu-search-params";
import type { CpuColumnSchema } from "./cpu-schema";
import { stableCpuKey } from "@/lib/favorites/cpu-stable-key";
// Inline notices handle favorites feedback; no toasts here.
import type { FavoriteKey } from "@/types/favorites";
import {
  FAVORITES_QUERY_KEY,
  FAVORITES_BROADCAST_CHANNEL,
} from "@/lib/favorites/constants";
import { getCpuFavorites } from "@/lib/favorites/cpu-api-client";
import { useAuthDialog } from "@/providers/auth-dialog-provider";
import { useAuth } from "@/providers/auth-client-provider";

interface CpuClientProps {
  initialFavoritesData?: CpuColumnSchema[];
  initialFavoriteKeys?: string[];
}

export function CpuClient({ initialFavoritesData, initialFavoriteKeys }: CpuClientProps = {}) {
  const contentRef = React.useRef<HTMLTableSectionElement>(null);
  const [search] = useQueryStates(cpuSearchParamsParser);
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
    queryFn: getCpuFavorites,
    staleTime: Infinity,
    enabled: false, // Never auto-fetch in this component (CheckedActionsIsland handles fetching)
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  /**
   * Cross-tab synchronization for CPU favorites view
   * Receives CPU favorites data directly from other tabs (no API call)
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
        favoriteKeys.has(stableCpuKey(row))
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
    ...cpuDataOptions(search),
    enabled: !isFavoritesMode, // Disable infinite query when showing favorites
  });

  useHotKey(() => {
    contentRef.current?.focus();
  }, ".");

  const flatData: CpuColumnSchema[] = React.useMemo(() => {
    if (isFavoritesMode) {
      // Use favorites data with optimistic updates
      return (favoritesData || initialFavoritesData || []) as CpuColumnSchema[];
    }
    // Server guarantees stable, non-overlapping windows via deterministic sort + cursor
    return (data?.pages?.flatMap((page: any) => page.data ?? []) as CpuColumnSchema[]) ?? [] as CpuColumnSchema[];
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

  const { sort, start, size, uuid, cursor, direction, observed_at, search: globalSearchRaw, ...filter } =
    search;

  // Convert null to undefined for component compatibility
  const globalSearch = globalSearchRaw || undefined;

  const derivedColumnFilters = React.useMemo<ColumnFiltersState>(() => {
    const baseFilters = Object.entries(filter)
      .map(([key, value]) => ({
        id: key,
        value,
      }))
      .filter(({ value }) => value ?? undefined);

    return baseFilters;
  }, [filter]);

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
    return cpuFilterFields.map((field: any) => {
      const facetsField = facets?.[field.value];
      if (!facetsField) return field;
      if (field.options && field.options.length > 0) return field;

      // REMINDER: if no options are set, we need to set them via the API
    const options = facetsField.rows.map(({ value }: any) => {
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
      <CpuDataTableInfinite
      key={`cpu-table-${isFavoritesMode ? `favorites-${favorites?.length || 0}` : 'all'}`}
      columns={cpuColumns}
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
      meta={metadata}
      filterFields={filterFields}
      sheetFields={cpuSheetFields}
      isFetching={isFavoritesMode ? false : isFetching}
      isLoading={isFavoritesMode ? false : isLoading}
      isFetchingNextPage={isFavoritesMode ? false : isFetchingNextPage}
      fetchNextPage={isFavoritesMode ? () => Promise.resolve() : fetchNextPage}
      hasNextPage={isFavoritesMode ? false : hasNextPage}
      getRowClassName={() => "opacity-100"}
      getRowId={(row) => row.uuid}
      getFacetedUniqueValues={getFacetedUniqueValues(facets)}
      getFacetedMinMaxValues={getFacetedMinMaxValues(facets)}
      renderSheetTitle={(props) => props.row?.original.uuid}
      searchParamsParser={cpuSearchParamsParser}
      search={globalSearch}
      focusTargetRef={contentRef}
    />
  );
}


// Helper functions (same as GPU client)
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

export function getFacetedUniqueValues<TData>(
  facets?: Record<string, CpuFacetMetadataSchema>,
) {
  return (_: TTable<TData>, columnId: string): Map<string, number> => {
    return new Map(
      facets?.[columnId]?.rows?.map(({ value, total }) => [value, total]) || [],
    );
  };
}

export function getFacetedMinMaxValues<TData>(
  facets?: Record<string, CpuFacetMetadataSchema>,
) {
  return (_: TTable<TData>, columnId: string): [number, number] | undefined => {
    const min = facets?.[columnId]?.min;
    const max = facets?.[columnId]?.max;
    if (typeof min === "number" && typeof max === "number") return [min, max];
    if (typeof min === "number") return [min, min];
    if (typeof max === "number") return [max, max];
    return undefined;
  };
}
