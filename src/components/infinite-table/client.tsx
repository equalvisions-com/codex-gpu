"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-client-provider";
import { useAuthDialog } from "@/providers/auth-dialog-provider";
import { columns } from "./columns";
import { filterFields as defaultFilterFields, sheetFields } from "./constants";
import { DataTableInfinite } from "./data-table-infinite";
import type { DataTableMeta } from "./data-table-infinite";
import { dataOptions } from "./query-options";
import type { RowWithId } from "@/types/api";
import type { ColumnSchema, FacetMetadataSchema } from "./schema";
// Inline notices handle favorites feedback; no toasts here.
import { getFavoritesBroadcastId } from "@/lib/favorites/broadcast";
import { MobileTopNav, SidebarPanel, type AccountUser } from "./account-components";
import { FAVORITES_QUERY_KEY } from "@/lib/favorites/constants";
import { useTableSearchState } from "./hooks/use-table-search-state";
import { useFavoritesState } from "./hooks/use-favorites-state";

interface ClientProps {
  initialFavoriteKeys?: string[];
  isFavoritesMode?: boolean;
}

const LazyFavoritesRuntime = React.lazy(() => import("./favorites-runtime"));

export function Client({ initialFavoriteKeys, isFavoritesMode }: ClientProps = {}) {
  const contentRef = React.useRef<HTMLTableSectionElement>(null);
  const {
    search,
    columnFilters,
    sorting,
    rowSelection,
    handleColumnFiltersChange,
    handleSortingChange,
    handleRowSelectionChange,
  } = useTableSearchState(defaultFilterFields);
  const bookmarksFlag = search.bookmarks === "true";
  const effectiveFavoritesMode =
    typeof isFavoritesMode === "boolean" ? isFavoritesMode : bookmarksFlag;
  const queryClient = useQueryClient();
  const router = useRouter();
  const { session, signOut, isPending: authPending } = useAuth();
  const { showSignIn, showSignUp } = useAuthDialog();
  const [isSigningOut, startSignOutTransition] = React.useTransition();
  const accountUser = (session?.user ?? null) as AccountUser | null;
  const broadcastId = React.useMemo(() => getFavoritesBroadcastId(), []);

  const clearFavoriteQueries = React.useCallback(() => {
    queryClient.removeQueries({ queryKey: FAVORITES_QUERY_KEY });
    queryClient.removeQueries({ queryKey: ["favorites", "rows"], exact: false });
  }, [queryClient]);

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
        clearFavoriteQueries();
        router.refresh();
      }
    });
  }, [clearFavoriteQueries, router, signOut]);

  const { favoritesSnapshot, handleFavoritesSnapshot, shouldHydrateFavorites } =
    useFavoritesState({
      initialFavoriteKeys,
      effectiveFavoritesMode,
      queryClient,
    });
  const noopAsync = React.useCallback(async () => {}, []);


  const {
    data,
    isFetching,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    isError,
    error,
    refetch,
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
  const effectiveFavoriteKeys = effectiveFavoritesMode
    ? favoritesSnapshot?.favoriteKeysFromRows ?? []
    : initialFavoriteKeys;
  
  const metadata: DataTableMeta<Record<string, unknown>> = {
    ...(lastPage?.meta?.metadata ?? {}),
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
  const tableIsError = effectiveFavoritesMode ? false : isError;
  const tableError = effectiveFavoritesMode ? null : error;
  const tableRetry = effectiveFavoritesMode ? noopAsync : refetch;
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

  // REMINDER: filter metadata is hydrated from the API so checkboxes/sliders stay accurate
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
        isError={tableIsError}
        error={tableError}
        onRetry={tableRetry}
        getRowClassName={() => "opacity-100"}
        getRowId={(row) => row.uuid}
        renderSheetTitle={(props) => props.row?.original.uuid}
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
