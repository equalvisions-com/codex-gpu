"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-client-provider";
import { useAuthDialog } from "@/providers/auth-dialog-provider";
import { modelsColumns } from "./models-columns";
import { modelsDataOptions } from "./models-query-options";
import {
  filterFields as defaultFilterFields,
  modelsColumnOrder,
  sheetFields,
} from "./models-constants";
import type { ModelsColumnSchema, ModelsFacetMetadataSchema } from "./models-schema";
import type { ModalitiesDirection } from "./modalities-filter";
import type { ModelFavoriteKey } from "@/types/model-favorites";
import { MobileTopNav, SidebarPanel, type AccountUser } from "../table/account-components";
import {
  DataTableInfinite,
  type DataTableMeta,
} from "../table/data-table-infinite";
import { getFavoritesBroadcastId } from "@/lib/model-favorites/broadcast";
import { MODEL_FAVORITES_QUERY_KEY } from "@/lib/model-favorites/constants";
import { useModelsTableSearchState } from "./hooks/use-models-table-search-state";
import { useModelsFavoritesState } from "./hooks/use-models-favorites-state";
import { ModelsCheckedActionsIsland } from "./models-checked-actions-island";

interface ModelsClientProps {
  initialFavoriteKeys?: ModelFavoriteKey[];
  isFavoritesMode?: boolean;
}

const LazyFavoritesRuntime = React.lazy(() => import("./models-favorites-runtime"));
const LazyModelSheetCharts = React.lazy(() =>
  import("./model-sheet-charts").then((module) => ({
    default: module.ModelSheetCharts,
  })),
);

export function ModelsClient({ initialFavoriteKeys, isFavoritesMode }: ModelsClientProps = {}) {
  const contentRef = React.useRef<HTMLTableSectionElement>(null);
  const {
    search,
    columnFilters,
    sorting,
    rowSelection,
    handleColumnFiltersChange,
    handleSortingChange,
    handleRowSelectionChange,
  } = useModelsTableSearchState(defaultFilterFields);
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
    queryClient.removeQueries({ queryKey: MODEL_FAVORITES_QUERY_KEY });
    queryClient.removeQueries({ queryKey: ["model-favorites", "rows"], exact: false });
  }, [queryClient]);

  const { favoritesSnapshot, handleFavoritesSnapshot, shouldHydrateFavorites } =
    useModelsFavoritesState({
      initialFavoriteKeys,
      effectiveFavoritesMode,
      queryClient,
    });
  const noopAsync = React.useCallback(async () => {}, []);

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
    ...modelsDataOptions(search),
    enabled: !effectiveFavoritesMode,
  });

  const baseFlatData = React.useMemo(() => {
    return (data?.pages?.flatMap((page) => page.data ?? []) as ModelsColumnSchema[]) ?? ([] as ModelsColumnSchema[]);
  }, [data?.pages]);

  const baseLastPage = data?.pages?.[data?.pages.length - 1];
  const favoritesFlatData = favoritesSnapshot?.flatData ?? [];
  const favoritesLastPage = favoritesSnapshot?.lastPage;

  const flatData = effectiveFavoritesMode ? favoritesFlatData : baseFlatData;
  const lastPage = effectiveFavoritesMode ? favoritesLastPage : baseLastPage;
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
  const effectiveFavoriteKeys = effectiveFavoritesMode
    ? favoritesSnapshot?.favoriteKeysFromRows ?? []
    : initialFavoriteKeys;

  const metadata: DataTableMeta<Record<string, unknown>, ModelFavoriteKey> = {
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
  const tableFetchNextPage =
    effectiveFavoritesMode && favoritesSnapshot?.fetchNextPage
      ? favoritesSnapshot.fetchNextPage
      : effectiveFavoritesMode
        ? noopAsync
        : fetchNextPage;
  const tableHasNextPage = effectiveFavoritesMode
    ? favoritesSnapshot?.hasNextPage ?? false
    : hasNextPage;
  const tableIsError = effectiveFavoritesMode ? false : isError;
  const tableError = effectiveFavoritesMode ? null : error;
  const tableRetry = effectiveFavoritesMode ? noopAsync : refetch;

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
  }, [castFacets]);

  return (
    <>
      {shouldHydrateFavorites ? (
        <React.Suspense fallback={null}>
          <LazyFavoritesRuntime
            search={search}
            isActive={effectiveFavoritesMode}
            session={session}
            authPending={authPending}
            broadcastId={broadcastId}
            onStateChange={handleFavoritesSnapshot}
          />
        </React.Suspense>
      ) : null}
      <DataTableInfinite
        key={`models-table-${effectiveFavoritesMode ? "favorites" : "all"}`}
        columns={modelsColumns}
        columnOrder={modelsColumnOrder}
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
        renderSheetTitle={({ row }) => {
          if (!row) return "AI Model Details";
          const model = row.original as ModelsColumnSchema;
          return model.shortName || model.name || "Model Details";
        }}
        getRowId={(row) => row.id}
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
        mobileHeaderOffset="36px"
        primaryColumnId="name"
        renderSheetCharts={(row) => {
          const selectedModel = row?.original as ModelsColumnSchema | undefined;
          if (!selectedModel?.permaslug || !selectedModel?.endpointId) {
            return null;
          }

          return (
            <React.Suspense
              fallback={
                <div className="grid gap-4">
                  <div className="h-[240px] animate-pulse rounded-lg bg-muted" />
                  <div className="h-[240px] animate-pulse rounded-lg bg-muted" />
                </div>
              }
            >
              <LazyModelSheetCharts
                permaslug={selectedModel.permaslug}
                endpointId={selectedModel.endpointId}
                provider={selectedModel?.provider}
                throughput={selectedModel?.throughput}
              />
            </React.Suspense>
          );
        }}
        renderCheckedActions={(meta) => (
          <ModelsCheckedActionsIsland
            initialFavoriteKeys={meta.initialFavoriteKeys}
          />
        )}
      />
    </>
  );
}

function areSearchPayloadsEqual(
  previous: Record<string, unknown> | null,
  next: Record<string, unknown>,
) {
  if (!previous) return false;
  const previousKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);
  if (previousKeys.length !== nextKeys.length) return false;

  for (const key of nextKeys) {
    if (!previousKeys.includes(key)) return false;
    if (!isLooseEqual(previous[key], next[key])) return false;
  }

  return true;
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
