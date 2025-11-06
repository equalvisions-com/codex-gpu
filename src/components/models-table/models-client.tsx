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
import { modelsColumns } from "./models-columns";
import { modelsDataOptions } from "./models-query-options";
import { modelsSearchParamsParser } from "./models-search-params";
import { ModelsDataTableInfinite, type ModelsDataTableMeta } from "./models-data-table-infinite";
import { filterFields as defaultFilterFields, sheetFields } from "./models-constants";
import type { ModelsColumnSchema, ModelsFacetMetadataSchema } from "./models-schema";
import type { ModalitiesDirection } from "./modalities-filter";
import type { ModelFavoriteKey } from "@/types/model-favorites";
import { MODEL_FAVORITES_BROADCAST_CHANNEL, MODEL_FAVORITES_QUERY_KEY } from "@/lib/model-favorites/constants";
import { favoritesDataOptions } from "./models-favorites-query-options";
import { getModelFavorites } from "@/lib/model-favorites/api-client";
import { stableModelKey } from "./stable-key";
import { MobileTopNav, SidebarPanel, type AccountUser } from "../infinite-table/account-components";
import { syncModelFavorites } from "@/lib/model-favorites/sync";
import { getFavoritesBroadcastId } from "@/lib/model-favorites/broadcast";

interface ModelsClientProps {
  initialFavoriteKeys?: ModelFavoriteKey[];
  isFavoritesMode?: boolean;
}

export function ModelsClient({ initialFavoriteKeys, isFavoritesMode = false }: ModelsClientProps = {}) {
  const contentRef = React.useRef<HTMLTableSectionElement>(null);
  const broadcastChannelRef = React.useRef<BroadcastChannel | null>(null);
  const [search] = useQueryStates(modelsSearchParamsParser);
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
  const initializedRef = React.useRef(false);
  React.useEffect(() => {
    if (!initializedRef.current && initialFavoriteKeys) {
      syncModelFavorites({
        queryClient,
        favorites: initialFavoriteKeys,
        invalidateRows: false,
      });
      initializedRef.current = true;
    }
  }, [initialFavoriteKeys, queryClient]);

  // Fetch favorites when in favorites mode (for checkbox UI)
  // Only needed for the checkbox/selection UI, not for favorites view data
  const { data: favorites = [] } = useQuery({
    queryKey: MODEL_FAVORITES_QUERY_KEY,
    queryFn: getModelFavorites,
    staleTime: Infinity,
    enabled: false, // Disabled - only used for checkbox UI, fetched lazily when needed
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // BroadcastChannel setup for cross-tab favorites sync
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
      return;
    }

    if (!broadcastChannelRef.current) {
      broadcastChannelRef.current = new BroadcastChannel(MODEL_FAVORITES_BROADCAST_CHANNEL);
    }

    const bc = broadcastChannelRef.current;
    const timeoutIds: NodeJS.Timeout[] = [];

    const handleMessage = async (event: MessageEvent<any>) => {
      if (event.data?.type !== "updated" || !Array.isArray(event.data?.favorites)) {
        return;
      }

      if (event.data?.source === broadcastId) {
        return;
      }

      const newFavorites = event.data.favorites as ModelFavoriteKey[];

      syncModelFavorites({
        queryClient,
        favorites: newFavorites,
      });

      // Always invalidate rows so next favorites view gets fresh data
      void queryClient.invalidateQueries({
        queryKey: ["model-favorites", "rows"],
        exact: false,
      });

      // If we're currently in favorites mode, refetch immediately after invalidation
      if (isFavoritesMode) {
        const timeoutId = setTimeout(() => {
          void queryClient.refetchQueries({
            queryKey: ["model-favorites", "rows"],
            exact: false,
            type: "active",
          });
        }, 100);
        timeoutIds.push(timeoutId);
      }
    };

    bc.onmessage = handleMessage;

    return () => {
      if (bc) {
        bc.onmessage = null;
      }
      timeoutIds.forEach(clearTimeout);
    };
  }, [broadcastId, isFavoritesMode, queryClient]);

  React.useEffect(() => {
    return () => {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
        broadcastChannelRef.current = null;
      }
    };
  }, []);
  const prevFavoritesModeRef = React.useRef<boolean>(isFavoritesMode);
  React.useEffect(() => {
    const wasFavorites = prevFavoritesModeRef.current;
    prevFavoritesModeRef.current = isFavoritesMode;
    if (isFavoritesMode && !wasFavorites) {
      void queryClient.invalidateQueries({
        queryKey: ["model-favorites", "rows"],
        exact: false,
      });
    }
  }, [isFavoritesMode, queryClient]);

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
    const allKeys = new Set<ModelFavoriteKey>();
    favoriteData.pages.forEach((page) => {
      page.data.forEach((row) => {
        allKeys.add(stableModelKey(row) as ModelFavoriteKey);
      });
    });
    return Array.from(allKeys);
  }, [favoriteData?.pages, isFavoritesMode]);

  // Seed favorites cache with keys from favorites view
  // This ensures checkboxes are pre-checked immediately (no flicker)
  React.useEffect(() => {
    if (isFavoritesMode && favoriteKeysFromRows.length > 0) {
      const existing = queryClient.getQueryData<ModelFavoriteKey[]>(MODEL_FAVORITES_QUERY_KEY);
      if (!existing || existing.length !== favoriteKeysFromRows.length) {
        queryClient.setQueryData(MODEL_FAVORITES_QUERY_KEY, favoriteKeysFromRows);
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
    ...modelsDataOptions(search),
    enabled: !isFavoritesMode,
  });

  useHotKey(() => {
    contentRef.current?.focus();
  }, ".");

  const flatData: ModelsColumnSchema[] = React.useMemo(() => {
    if (isFavoritesMode) {
      return (favoriteData?.pages?.flatMap((page) => page.data ?? []) as ModelsColumnSchema[]) ?? [] as ModelsColumnSchema[];
    }
    return (data?.pages?.flatMap((page) => page.data ?? []) as ModelsColumnSchema[]) ?? [] as ModelsColumnSchema[];
  }, [data?.pages, favoriteData?.pages, isFavoritesMode]);

  const lastPage = isFavoritesMode 
    ? favoriteData?.pages?.[favoriteData.pages.length - 1]
    : data?.pages?.[data?.pages.length - 1];
  const rawFacets = lastPage?.meta?.facets;
  const facetsRef = React.useRef<Record<string, ModelsFacetMetadataSchema> | undefined>(undefined);
  React.useEffect(() => {
    if (rawFacets && Object.keys(rawFacets).length) {
      facetsRef.current = rawFacets;
    }
  }, [rawFacets]);
  const stableFacets = React.useMemo(() => {
    if (rawFacets && Object.keys(rawFacets).length) {
      return rawFacets;
    }
    return facetsRef.current ?? {};
  }, [rawFacets]);
  const castFacets = stableFacets as Record<string, ModelsFacetMetadataSchema> | undefined;
  const totalDBRowCount = lastPage?.meta?.totalRowCount ?? flatData.length;
  const filterDBRowCount = lastPage?.meta?.filterRowCount ?? flatData.length;
  const totalFetched = flatData.length;

  // Use favorite keys from rows query if in favorites mode, otherwise use initialFavoriteKeys from SSR
  const effectiveFavoriteKeys = isFavoritesMode ? favoriteKeysFromRows : initialFavoriteKeys;

  const metadata: ModelsDataTableMeta<Record<string, unknown>> = {
    ...(lastPage?.meta?.metadata ?? {}),
    initialFavoriteKeys: effectiveFavoriteKeys,
  };

  const { sort, uuid, search: globalSearch, ...filter } = search;

  const derivedColumnFilters = React.useMemo<ColumnFiltersState>(() => {
    const baseFilters = Object.entries(filter)
      .map(([key, value]) => {
        if (key === "modalityDirections" && Array.isArray(value)) {
          const directionEntries = value
            .map((entry) => {
              const [modality, dir] = String(entry).split(":");
              if (!modality) return null;
              const direction = dir === "output" ? "output" : "input";
              return [modality, direction] as const;
            })
            .filter((entry): entry is readonly [string, ModalitiesDirection] => Boolean(entry));

          return {
            id: key,
            value: Object.fromEntries(directionEntries),
          };
        }

        return { id: key, value };
      })
      .filter(({ value }) => value ?? undefined);

    if (typeof globalSearch === "string" && globalSearch.trim().length) {
      baseFilters.push({ id: "search", value: globalSearch });
    }

    return baseFilters;
  }, [filter, globalSearch]);

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(derivedColumnFilters);
  const derivedColumnFiltersRef = React.useRef<ColumnFiltersState>(derivedColumnFilters);

  React.useEffect(() => {
    if (!areColumnFiltersEqual(derivedColumnFiltersRef.current, derivedColumnFilters)) {
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
    return uuid ? { [uuid]: true } : {};
  }, [uuid]);

  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>(derivedRowSelection);
  const derivedRowSelectionRef = React.useRef<RowSelectionState>(derivedRowSelection);

  React.useEffect(() => {
    if (!isRowSelectionEqual(derivedRowSelectionRef.current, derivedRowSelection)) {
      setRowSelection(derivedRowSelection);
    }
    derivedRowSelectionRef.current = derivedRowSelection;
  }, [derivedRowSelection]);

  const filterFields = React.useMemo(() => {
    return defaultFilterFields.map((field) => {
      const facetsField = castFacets?.[field.value];
      if (!facetsField) return field;
      if (field.options && field.options.length > 0) return field;

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
          options,
        };
      }

      if (field.type === "checkbox") {
        return { ...field, options };
      }

      return field;
    });
  }, [stableFacets]);

  return (
    <ModelsDataTableInfinite
      key={`models-table-${isFavoritesMode ? "favorites" : "all"}`}
      columns={modelsColumns}
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
      meta={{ ...metadata, facets: castFacets }}
      filterFields={filterFields}
      sheetFields={sheetFields}
      isFetching={isFavoritesMode ? isFetchingFavorites : isFetching}
      isLoading={isFavoritesMode ? isFavoritesLoading : isLoading}
      isFetchingNextPage={isFavoritesMode ? isFetchingNextPageFavorites : isFetchingNextPage}
      fetchNextPage={isFavoritesMode ? fetchNextPageFavorites : fetchNextPage}
      hasNextPage={isFavoritesMode ? hasNextPageFavorites : hasNextPage}
      renderSheetTitle={({ row }) => {
        if (!row) return "AI Model Details";
        const model = row.original as ModelsColumnSchema;
        return model.shortName || model.name || "Model Details";
      }}
      modelsSearchParamsParser={modelsSearchParamsParser}
      getRowId={(row) => row.id}
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

function areColumnFiltersEqual(a: ColumnFiltersState, b: ColumnFiltersState) {
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
  if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}
