"use client";

import { useHotKey } from "@/hooks/use-hot-key";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
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
import { MobileTopNav, SidebarPanel, type AccountUser } from "../infinite-table/account-components";
import { syncModelFavorites } from "@/lib/model-favorites/sync";
import { getFavoritesBroadcastId } from "@/lib/model-favorites/broadcast";
import type { FavoritesRuntimeSnapshot } from "./models-favorites-runtime";

interface ModelsClientProps {
  initialFavoriteKeys?: ModelFavoriteKey[];
  isFavoritesMode?: boolean;
}

const LazyFavoritesRuntime = React.lazy(() => import("./models-favorites-runtime"));

export function ModelsClient({ initialFavoriteKeys, isFavoritesMode }: ModelsClientProps = {}) {
  const contentRef = React.useRef<HTMLTableSectionElement>(null);
  const [search] = useQueryStates(modelsSearchParamsParser);
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
  const [favoritesSnapshot, setFavoritesSnapshot] = React.useState<FavoritesRuntimeSnapshot | null>(null);
  const noopAsync = React.useCallback(async () => {}, []);

  const handleFavoritesSnapshot = React.useCallback((snapshot: FavoritesRuntimeSnapshot | null) => {
    setFavoritesSnapshot(snapshot);
  }, []);

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

  const shouldHydrateFavorites = effectiveFavoritesMode;


  const {
    data,
    isFetching,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    ...modelsDataOptions(search),
    enabled: !effectiveFavoritesMode,
  });

  useHotKey(() => {
    contentRef.current?.focus();
  }, ".");

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
  const totalDBRowCount = effectiveFavoritesMode
    ? favoritesSnapshot?.totalRowCount ?? favoritesFlatData.length
    : baseLastPage?.meta?.totalRowCount ?? baseFlatData.length;
  const filterDBRowCount = effectiveFavoritesMode
    ? favoritesSnapshot?.filterRowCount ?? favoritesFlatData.length
    : baseLastPage?.meta?.filterRowCount ?? baseFlatData.length;
  const totalFetched = effectiveFavoritesMode
    ? favoritesSnapshot?.totalFetched ?? favoritesFlatData.length
    : baseFlatData.length;

  const effectiveFavoriteKeys = effectiveFavoritesMode
    ? favoritesSnapshot?.favoriteKeysFromRows ?? []
    : initialFavoriteKeys;

  const metadata: ModelsDataTableMeta<Record<string, unknown>> = {
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
      <ModelsDataTableInfinite
        key={`models-table-${effectiveFavoritesMode ? "favorites" : "all"}`}
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
        isFetching={tableIsFetching}
        isLoading={tableIsLoading}
        isFetchingNextPage={tableIsFetchingNextPage}
        fetchNextPage={tableFetchNextPage}
        hasNextPage={tableHasNextPage}
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


