"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ColumnFiltersState,
  OnChangeFn,
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
import type { DataTableMeta } from "./data-table-infinite";
import { dataOptions } from "./query-options";
import { searchParamsParser } from "./search-params";
import type { RowWithId } from "@/types/api";
import type { ColumnSchema, FacetMetadataSchema } from "./schema";
// Inline notices handle favorites feedback; no toasts here.
import { syncFavorites } from "@/lib/favorites/sync";
import { getFavoritesBroadcastId } from "@/lib/favorites/broadcast";
import type { FavoritesRuntimeSnapshot } from "./favorites-runtime";
import { MobileTopNav, SidebarPanel, type AccountUser } from "./account-components";

interface ClientProps {
  initialFavoriteKeys?: string[];
  isFavoritesMode?: boolean;
}

const LazyFavoritesRuntime = React.lazy(() => import("./favorites-runtime"));

export function Client({ initialFavoriteKeys, isFavoritesMode }: ClientProps = {}) {
  const contentRef = React.useRef<HTMLTableSectionElement>(null);
  const [search, setSearch] = useQueryStates(searchParamsParser);
  const favoritesFlag = search.favorites === "true";
  const effectiveFavoritesMode =
    typeof isFavoritesMode === "boolean" ? isFavoritesMode : favoritesFlag;
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
      syncFavorites({
        queryClient,
        favorites: initialFavoriteKeys,
        invalidateRows: false,
      });
      initializedRef.current = true;
    }
  }, [initialFavoriteKeys, queryClient]);

  const [favoritesSnapshot, setFavoritesSnapshot] = React.useState<FavoritesRuntimeSnapshot | null>(null);
  const handleFavoritesSnapshot = React.useCallback((snapshot: FavoritesRuntimeSnapshot | null) => {
    setFavoritesSnapshot(snapshot);
  }, []);
  const noopAsync = React.useCallback(async () => {}, []);
  const shouldHydrateFavorites = effectiveFavoritesMode;


  const {
    data,
    isFetching,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    ...dataOptions(search),
    enabled: !effectiveFavoritesMode,
  });

  const baseFlatData = React.useMemo(() => {
    return (data?.pages?.flatMap((page) => page.data ?? []) as RowWithId[]) ?? ([] as RowWithId[]);
  }, [data?.pages]);
  const baseLastPage = data?.pages?.[data?.pages.length - 1];

  const favoritesFlatData = favoritesSnapshot?.flatData ?? [];
  const favoritesLastPage = favoritesSnapshot?.lastPage;

  const flatData = effectiveFavoritesMode ? favoritesFlatData : baseFlatData;
  const lastPage = effectiveFavoritesMode ? favoritesLastPage : baseLastPage;
  const facetsFromPage = lastPage?.meta?.facets;
  const totalDBRowCount = effectiveFavoritesMode
    ? favoritesSnapshot?.totalRowCount ?? favoritesFlatData.length
    : baseLastPage?.meta?.totalRowCount ?? baseFlatData.length;

  const effectiveFavoriteKeys = effectiveFavoritesMode
    ? favoritesSnapshot?.favoriteKeysFromRows ?? []
    : initialFavoriteKeys;
  
  const metadata: DataTableMeta<Record<string, unknown>> = {
    ...(lastPage?.meta?.metadata ?? {}),
    totalRows: totalDBRowCount ?? 0,
    initialFavoriteKeys: effectiveFavoriteKeys,
  };

  const tableIsFetching = effectiveFavoritesMode
    ? favoritesSnapshot?.isFetching ?? false
    : isFetching;
  const tableIsLoading = effectiveFavoritesMode
    ? favoritesSnapshot?.isFavoritesLoading ?? true
    : isLoading;
  const tableIsFetchingNextPage = effectiveFavoritesMode
    ? favoritesSnapshot?.isFetchingNextPage ?? false
    : isFetchingNextPage;
  const tableFetchNextPage = effectiveFavoritesMode
    ? favoritesSnapshot?.fetchNextPage ?? noopAsync
    : fetchNextPage;
  const tableHasNextPage = effectiveFavoritesMode
    ? favoritesSnapshot?.hasNextPage ?? false
    : hasNextPage;
  const facetsRef = React.useRef<Record<string, FacetMetadataSchema> | undefined>(undefined);
  React.useEffect(() => {
    if (facetsFromPage && Object.keys(facetsFromPage).length) {
      facetsRef.current = facetsFromPage;
    }
  }, [facetsFromPage]);
  const stableFacets = React.useMemo(() => {
    if (facetsFromPage && Object.keys(facetsFromPage).length) {
      return facetsFromPage;
    }
    return facetsRef.current ?? {};
  }, [facetsFromPage]);
  const castFacets = stableFacets as Record<string, FacetMetadataSchema> | undefined;

  const {
    sort,
    size: _size,
    uuid,
    cursor: _cursor,
    observed_at: _observedAt,
    search: globalSearch,
    ...filter
  } = search;

  const columnFilters = React.useMemo<ColumnFiltersState>(() => {
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

  const sorting = React.useMemo<SortingState>(() => {
    return sort ? [sort] : [];
  }, [sort]);

  const rowSelection = React.useMemo<RowSelectionState>(() => {
    return search.uuid ? { [search.uuid]: true } : {};
  }, [search.uuid]);

  // REMINDER: filter metadata is hydrated from the API so checkboxes/sliders stay accurate
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

  const previousFilterPayloadRef = React.useRef<Record<string, unknown> | null>(null);
  const handleColumnFiltersChange = React.useCallback<OnChangeFn<ColumnFiltersState>>(
    (updater) => {
      const nextFilters =
        typeof updater === "function" ? updater(columnFilters) : updater ?? [];
      const searchPayload: Record<string, unknown> = {};

      filterFields.forEach((field) => {
        const columnFilter = nextFilters.find((filter) => filter.id === field.value);
        searchPayload[field.value as string] = columnFilter ? columnFilter.value : null;
      });

      if (
        previousFilterPayloadRef.current &&
        areSearchPayloadsEqual(previousFilterPayloadRef.current, searchPayload)
      ) {
        return;
      }

      previousFilterPayloadRef.current = searchPayload;
      setSearch(searchPayload);
    },
    [columnFilters, filterFields, setSearch],
  );

  const previousSortParamRef = React.useRef<string>("__init__");
  const handleSortingChange = React.useCallback<OnChangeFn<SortingState>>(
    (updater) => {
      const nextSorting =
        typeof updater === "function" ? updater(sorting) : updater ?? [];
      const sortEntry = nextSorting[0] ?? null;
      const serialized =
        sortEntry === null
          ? "null"
          : `${sortEntry.id}:${sortEntry.desc ? "desc" : "asc"}`;
      if (previousSortParamRef.current === serialized) {
        return;
      }
      previousSortParamRef.current = serialized;
      setSearch({ sort: sortEntry ?? null });
    },
    [setSearch, sorting],
  );

  const previousUuidRef = React.useRef<string>("__init__");
  const handleRowSelectionChange = React.useCallback<OnChangeFn<RowSelectionState>>(
    (updater) => {
      const nextSelection =
        typeof updater === "function" ? updater(rowSelection) : updater ?? {};
      const selectedKeys = Object.keys(nextSelection ?? {});
      const nextUuid = selectedKeys[0] ?? null;
      const serializedUuid = nextUuid ?? "null";
      if (previousUuidRef.current === serializedUuid) {
        return;
      }
      previousUuidRef.current = serializedUuid;
      setSearch({ uuid: nextUuid });
    },
    [rowSelection, setSearch],
  );

  return (
    <>
      {shouldHydrateFavorites ? (
        <React.Suspense fallback={null}>
          <LazyFavoritesRuntime
            search={search}
            isActive={effectiveFavoritesMode}
            session={session}
            authPending={authPending}
            onStateChange={handleFavoritesSnapshot}
            broadcastId={broadcastId}
          />
        </React.Suspense>
      ) : null}
      <DataTableInfinite
        key={`table-${effectiveFavoritesMode ? "favorites" : "all"}`}
        columns={columns}
        data={flatData}
        skeletonRowCount={50}
        skeletonNextPageRowCount={undefined}
        totalRows={metadata.totalRows}
        columnFilters={columnFilters}
        onColumnFiltersChange={handleColumnFiltersChange}
        sorting={sorting}
        onSortingChange={handleSortingChange}
        rowSelection={rowSelection}
        onRowSelectionChange={handleRowSelectionChange}
        meta={{ ...metadata, facets: castFacets }}
        filterFields={filterFields}
        sheetFields={sheetFields}
        isFetching={tableIsFetching}
        isLoading={tableIsLoading}
        isFetchingNextPage={tableIsFetchingNextPage}
        fetchNextPage={tableFetchNextPage}
        hasNextPage={tableHasNextPage}
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
          isLoading: authPending,
        }}
        headerSlot={
          <MobileTopNav
            user={accountUser}
            onSignOut={handleSignOut}
            onSignIn={handleSignIn}
            onSignUp={handleSignUp}
            isSigningOut={isSigningOut}
            isAuthLoading={authPending}
            renderSidebar={() => (
              <SidebarPanel
                user={accountUser}
                onSignOut={handleSignOut}
                isSigningOut={isSigningOut}
                className="flex-1"
                showUserMenuFooter={false}
                isAuthLoading={authPending}
              />
            )}
          />
        }
        mobileHeaderOffset="38px"
      />
    </>
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

function areSearchPayloadsEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
) {
  const aEntries = Object.entries(a ?? {}).filter(
    ([_, value]) => value !== undefined,
  );
  const bEntries = Object.entries(b ?? {}).filter(
    ([_, value]) => value !== undefined,
  );
  if (aEntries.length !== bEntries.length) return false;
  return aEntries.every(([key, value]) => {
    const other = b[key];
    if (Array.isArray(value) && Array.isArray(other)) {
      if (value.length !== other.length) return false;
      return value.every(
        (val, index) => JSON.stringify(val) === JSON.stringify(other[index]),
      );
    }
    return JSON.stringify(value) === JSON.stringify(other);
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
