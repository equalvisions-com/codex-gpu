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
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-client-provider";
import { useAuthDialog } from "@/providers/auth-dialog-provider";
import { columns } from "./columns";
import { filterFields as defaultFilterFields, sheetFields } from "./constants";
import { DataTableInfinite } from "./data-table-infinite";
import { dataOptions } from "./query-options";
import { favoritesDataOptions } from "./favorites-query-options";
import { searchParamsParser } from "./search-params";
import type { RowWithId } from "@/types/api";
import type { ColumnSchema, FacetMetadataSchema } from "./schema";
import { stableGpuKey } from "./stable-key";
// Inline notices handle favorites feedback; no toasts here.
import type { FavoriteKey } from "@/types/favorites";
import { 
  FAVORITES_QUERY_KEY, 
  FAVORITES_BROADCAST_CHANNEL,
} from "@/lib/favorites/constants";
import { getFavorites } from "@/lib/favorites/api-client";
import { syncFavorites } from "@/lib/favorites/sync";
import { getFavoritesBroadcastId } from "@/lib/favorites/broadcast";
import { MobileTopNav, SidebarPanel, type AccountUser } from "./account-components";

interface ClientProps {
  initialFavoriteKeys?: string[];
  isFavoritesMode?: boolean;
}

export function Client({ initialFavoriteKeys, isFavoritesMode = false }: ClientProps = {}) {
  const contentRef = React.useRef<HTMLTableSectionElement>(null);
  const broadcastChannelRef = React.useRef<BroadcastChannel | null>(null);
  const [search] = useQueryStates(searchParamsParser);
  const queryClient = useQueryClient();
  const router = useRouter();
  const { session, signOut, isPending: authPending } = useAuth();
  const { showSignIn, showSignUp } = useAuthDialog();
  const [isSigningOut, startSignOutTransition] = React.useTransition();
  const accountUser = (session?.user ?? null) as AccountUser | null;
  const broadcastId = React.useMemo(() => getFavoritesBroadcastId(), []);

  const handleSignIn = React.useCallback(() => {
    if (!showSignIn) return;
    const callbackUrl =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "/";
    showSignIn({ callbackUrl });
  }, [showSignIn]);

  const handleSignUp = React.useCallback(() => {
    if (!showSignUp) return;
    const callbackUrl =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "/";
    showSignUp({ callbackUrl });
  }, [showSignUp]);

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

  // Seed cache with initialFavoriteKeys if provided (from SSR)
  // This is an optimization - the query will still run to ensure fresh data
const initializedRef = React.useRef(false);
  React.useEffect(() => {
    if (!initializedRef.current && initialFavoriteKeys) {
      syncFavorites({
        queryClient,
        favorites: initialFavoriteKeys,
        invalidateRows: false,
      });
      initializedRef.current = true;
    }
  }, [initialFavoriteKeys, queryClient]);

  const FAVORITES_CHUNK_SIZE = 200;

  const fetchFavoriteRowsByKeys = React.useCallback(
    async (keys: FavoriteKey[]): Promise<RowWithId[]> => {
      if (!keys.length) return [];

      const uniqueKeys = Array.from(new Set(keys));
      const rowsByKey = new Map<string, RowWithId>();

      for (let index = 0; index < uniqueKeys.length; index += FAVORITES_CHUNK_SIZE) {
        const chunk = uniqueKeys.slice(index, index + FAVORITES_CHUNK_SIZE);
        const response = await fetch("/api/favorites/rows", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ keys: chunk }),
        });

        if (!response.ok) {
          throw new Error("Failed to load favorite rows");
        }

        const json = (await response.json()) as { rows: RowWithId[] };
        for (const row of json.rows ?? []) {
          rowsByKey.set(row.uuid, row);
          rowsByKey.set(stableGpuKey(row), row);
        }
      }

      return keys
        .map((key) => rowsByKey.get(key))
        .filter((row): row is RowWithId => Boolean(row));
    },
    [],
  );

  // Fetch favorites when in favorites mode (for checkbox UI)
  // Only needed for the checkbox/selection UI, not for favorites view data
  const { data: favorites = [] } = useQuery({
    queryKey: FAVORITES_QUERY_KEY,
    queryFn: getFavorites,
    staleTime: Infinity,
    enabled: false, // Disabled - only used for checkbox UI, fetched lazily when needed
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  React.useEffect(() => {
    if (!isFavoritesMode) {
      // Clean up if mode changes away from favorites
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
        broadcastChannelRef.current = null;
      }
      return;
    }
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
      return;
    }
    
    // Guard: prevent multiple BroadcastChannel instances
    if (broadcastChannelRef.current) {
      return; // Already initialized
    }
    
    const bc = new BroadcastChannel(FAVORITES_BROADCAST_CHANNEL);
    broadcastChannelRef.current = bc;
    
    bc.onmessage = async (event) => {
      if (event.data?.type !== "updated" || !Array.isArray(event.data?.favorites)) {
        return;
      }

      if (event.data?.source === broadcastId) {
        return;
      }

      const newFavorites = event.data.favorites as FavoriteKey[];

      syncFavorites({
        queryClient,
        favorites: newFavorites,
      });

      // Invalidate favorites query to refetch with new favorites
      // This ensures pagination works correctly with updated favorites
      void queryClient.invalidateQueries({
        queryKey: ["favorites", "rows"],
        exact: false,
      });
    };
    
    return () => {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
        broadcastChannelRef.current = null;
      }
    };
  }, [broadcastId, isFavoritesMode, queryClient]);

  // Fetch favorite rows with pagination when in favorites mode
  // Uses useInfiniteQuery for pagination (same as main table)
  // API endpoint uses unstable_cache server-side for favorite keys
  const {
    data: favoriteData,
    isFetching: isFetchingFavorites,
    isLoading: isLoadingFavorites,
    isFetchingNextPage: isFetchingNextPageFavorites,
    fetchNextPage: fetchNextPageFavorites,
    hasNextPage: hasNextPageFavorites,
    status: favoritesStatus,
  } = useInfiniteQuery({
    ...favoritesDataOptions(search),
    enabled: isFavoritesMode && !!session && !authPending,
  });

  // Show loading state if:
  // - Query is loading
  // - Query is pending (not started yet, including when disabled)
  // - Query is disabled but we're waiting for auth (session pending or not authenticated)
  // When query is disabled, TanStack Query sets isLoading=false, so we need to check status and auth state
  const isFavoritesLoading = isLoadingFavorites || 
    favoritesStatus === 'pending' || 
    (isFavoritesMode && (authPending || !session));

  // Extract favorite keys from all pages (for checkbox UI)
  const favoriteKeysFromRows = React.useMemo(() => {
    if (!isFavoritesMode || !favoriteData?.pages || favoriteData.pages.length === 0) {
      return [];
    }
    // Get all favorite keys from all pages
    const allKeys = new Set<FavoriteKey>();
    favoriteData.pages.forEach((page) => {
      page.data.forEach((row) => {
        allKeys.add(stableGpuKey(row) as FavoriteKey);
      });
    });
    return Array.from(allKeys);
  }, [favoriteData?.pages, isFavoritesMode]);

  // Seed favorites cache with keys from favorites view
  // This ensures checkboxes are pre-checked immediately (no flicker)
  React.useEffect(() => {
    if (isFavoritesMode && favoriteKeysFromRows.length > 0) {
      const existing = queryClient.getQueryData<FavoriteKey[]>(FAVORITES_QUERY_KEY);
      if (!existing || existing.length !== favoriteKeysFromRows.length) {
        queryClient.setQueryData(FAVORITES_QUERY_KEY, favoriteKeysFromRows);
      }
    }
  }, [isFavoritesMode, favoriteKeysFromRows, queryClient]);


  const {
    data,
    isFetching,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    ...dataOptions(search),
    enabled: !isFavoritesMode,
  });

  useHotKey(() => {
    contentRef.current?.focus();
  }, ".");

  const flatData: RowWithId[] = React.useMemo(() => {
    if (isFavoritesMode) {
      return (favoriteData?.pages?.flatMap((page) => page.data ?? []) as RowWithId[]) ?? [] as RowWithId[];
    }
    // Server guarantees stable, non-overlapping windows via deterministic sort + cursor
    return (data?.pages?.flatMap((page) => page.data ?? []) as RowWithId[]) ?? [] as RowWithId[];
  }, [data?.pages, favoriteData?.pages, isFavoritesMode]);

  // REMINDER: meta data is always the same for all pages as filters do not change(!)
  const lastPage = isFavoritesMode 
    ? favoriteData?.pages?.[favoriteData.pages.length - 1]
    : data?.pages?.[data?.pages.length - 1];
  const totalDBRowCount = isFavoritesMode ? flatData.length : lastPage?.meta?.totalRowCount;
  const filterDBRowCount = isFavoritesMode ? flatData.length : lastPage?.meta?.filterRowCount;
  
  // Use favorite keys from rows query if in favorites mode, otherwise use initialFavoriteKeys from SSR
  const effectiveFavoriteKeys = isFavoritesMode ? favoriteKeysFromRows : initialFavoriteKeys;
  
  const metadata = {
    ...(lastPage?.meta?.metadata ?? {}),
    initialFavoriteKeys: effectiveFavoriteKeys,
  } as Record<string, unknown>;
  const facets = isFavoritesMode ? {} : lastPage?.meta?.facets;
  const facetsRef = React.useRef<Record<string, FacetMetadataSchema> | undefined>(undefined);
  React.useEffect(() => {
    if (facets && Object.keys(facets).length) {
      facetsRef.current = facets;
    }
  }, [facets]);
  const stableFacets = React.useMemo(() => {
    if (isFavoritesMode) return {};
    return facets && Object.keys(facets).length ? facets : facetsRef.current ?? {};
  }, [facets, isFavoritesMode]);
  const castFacets = stableFacets as Record<string, FacetMetadataSchema> | undefined;
  const totalFetched = flatData?.length;

  const { sort, start, size, uuid, cursor, direction, observed_at, search: globalSearch, ...filter } =
    search;

  const derivedColumnFilters = React.useMemo<ColumnFiltersState>(() => {
    const baseFilters = Object.entries(filter)
      .map(([key, value]) => ({
        id: key,
        value: value as unknown,
      }))
      .filter(({ value }) => value ?? undefined) as ColumnFiltersState;

    if (typeof globalSearch === "string" && globalSearch.trim().length) {
      baseFilters.push({ id: "search", value: globalSearch } as { id: string; value: unknown });
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
  const previousSortingRef = React.useRef<SortingState>(derivedSorting);

  React.useEffect(() => {
    if (!isSortingStateEqual(derivedSortingRef.current, derivedSorting)) {
      setSorting(derivedSorting);
    }
    derivedSortingRef.current = derivedSorting;
  }, [derivedSorting]);

  // Only scroll to top when sorting actually changes (user clicks column header)
  // Not when pagination happens (which shouldn't change sorting)
  React.useEffect(() => {
    const didSortingChange = !isSortingStateEqual(previousSortingRef.current, sorting);
    if (didSortingChange && sorting.length > 0) {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
    previousSortingRef.current = sorting;
  }, [sorting]);

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
      const facetsField = castFacets?.[field.value];
      if (!facetsField) return field;
      if (field.options && field.options.length > 0) return field;

      // REMINDER: if no options are set, we need to set them via the API
      // Filter rows to ensure they have the expected structure (same as models table)
      // Check if rows exists and is an array before processing
      if (!facetsField.rows || !Array.isArray(facetsField.rows)) {
        return field;
      }

      const options = facetsField.rows
        .filter((row) => row && typeof row === "object" && "value" in row)
        .map(({ value }) => {
          const label = value == null ? "Unknown" : String(value);
          return { label, value };
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
  }, [castFacets]);

  return (
    <DataTableInfinite
      key={`table-${isFavoritesMode ? "favorites" : "all"}`}
      columns={columns}
      data={flatData}
      skeletonRowCount={50}
      skeletonNextPageRowCount={undefined}
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
        facets: castFacets,
        totalRows: totalDBRowCount ?? 0,
        filterRows: filterDBRowCount ?? 0,
        totalRowsFetched: totalFetched ?? 0,
      }}
      filterFields={filterFields}
      sheetFields={sheetFields}
      isFetching={isFavoritesMode ? isFetchingFavorites : isFetching}
      isLoading={isFavoritesMode ? isFavoritesLoading : isLoading}
      isFetchingNextPage={isFavoritesMode ? isFetchingNextPageFavorites : isFetchingNextPage}
      fetchNextPage={isFavoritesMode ? fetchNextPageFavorites : fetchNextPage}
      hasNextPage={isFavoritesMode ? hasNextPageFavorites : hasNextPage}
      getRowClassName={() => "opacity-100"}
      getRowId={(row) => row.uuid}
      renderSheetTitle={(props) => props.row?.original.uuid}
      searchParamsParser={searchParamsParser}
      focusTargetRef={contentRef}
      account={{
        user: accountUser,
        onSignOut: handleSignOut,
        isSigningOut,
        onSignIn: handleSignIn,
        onSignUp: handleSignUp,
      }}
      headerSlot={
        <MobileTopNav
          user={accountUser}
          onSignOut={handleSignOut}
          onSignIn={handleSignIn}
          onSignUp={handleSignUp}
          isSigningOut={isSigningOut}
          renderSidebar={() => (
            <SidebarPanel
              user={accountUser}
              onSignOut={handleSignOut}
              isSigningOut={isSigningOut}
              className="flex-1"
              showUserMenuFooter={false}
            />
          )}
        />
      }
      mobileHeaderOffset="38px"
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
