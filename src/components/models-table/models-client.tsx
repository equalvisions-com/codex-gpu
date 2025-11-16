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
import { MODEL_FAVORITES_QUERY_KEY } from "@/lib/model-favorites/constants";

interface ModelsClientProps {
  initialFavoriteKeys?: ModelFavoriteKey[];
  isFavoritesMode?: boolean;
}

const LazyFavoritesRuntime = React.lazy(() => import("./models-favorites-runtime"));

export function ModelsClient({ initialFavoriteKeys, isFavoritesMode }: ModelsClientProps = {}) {
  const contentRef = React.useRef<HTMLTableSectionElement>(null);
  const [search, setSearch] = useQueryStates(modelsSearchParamsParser);
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
  const clearFavoriteQueries = React.useCallback(() => {
    queryClient.removeQueries({ queryKey: MODEL_FAVORITES_QUERY_KEY });
    queryClient.removeQueries({ queryKey: ["model-favorites", "rows"], exact: false });
  }, [queryClient]);

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
        clearFavoriteQueries();
        router.refresh();
      }
    });
  }, [clearFavoriteQueries, router, signOut]);

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

  const columnFilters = React.useMemo<ColumnFiltersState>(() => derivedColumnFilters, [derivedColumnFilters]);

  const sorting = React.useMemo<SortingState>(() => {
    return sort ? [sort] : [];
  }, [sort]);

  const rowSelection = React.useMemo<RowSelectionState>(() => {
    return uuid ? { [uuid]: true } : {};
  }, [uuid]);

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

  const previousFiltersPayloadRef = React.useRef<Record<string, unknown> | null>(null);
  const handleColumnFiltersChange = React.useCallback<OnChangeFn<ColumnFiltersState>>(
    (updater) => {
      const nextFilters =
        typeof updater === "function" ? updater(columnFilters) : updater ?? [];
      const searchPayload: Record<string, unknown> = {};

      filterFields.forEach((field) => {
        if (field.value === "modalities") {
          const modalitiesFilter = nextFilters.find((filter) => filter.id === field.value);
          const modalityValue = modalitiesFilter?.value as string[] | undefined;
          const values = modalityValue ?? [];

          const directionsFilter = nextFilters.find((filter) => filter.id === "modalityDirections");
          const directionsValue = directionsFilter?.value as Record<string, ModalitiesDirection> | undefined;
          const directionEntries = directionsValue
            ? Object.entries(directionsValue)
                .map(([key, dir]) => `${key}:${dir}`)
                .sort()
            : [];

          searchPayload[field.value as string] = values.length ? values : null;
          searchPayload.modalityDirections =
            values.length && directionEntries.length ? directionEntries : null;
          return;
        }

        const columnFilter = nextFilters.find((filter) => filter.id === field.value);
        searchPayload[field.value as string] = columnFilter ? columnFilter.value : null;
      });

      if (
        previousFiltersPayloadRef.current &&
        areSearchPayloadsEqual(previousFiltersPayloadRef.current, searchPayload)
      ) {
        return;
      }

      previousFiltersPayloadRef.current = searchPayload;
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
        mobileHeaderOffset="38px"
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
