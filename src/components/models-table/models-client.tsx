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
import { ModelsDataTableInfinite } from "./models-data-table-infinite";
import { filterFields as defaultFilterFields, sheetFields } from "./models-constants";
import type { ModelsColumnSchema, ModelsFacetMetadataSchema } from "./models-schema";
import { stableModelKey } from "./stable-key";
import type { ModalitiesDirection } from "./modalities-filter";
import type { ModelFavoriteKey } from "@/types/model-favorites";
import { MODEL_FAVORITES_BROADCAST_CHANNEL, MODEL_FAVORITES_QUERY_KEY } from "@/lib/model-favorites/constants";
import { getModelFavorites } from "@/lib/model-favorites/api-client";
import { MobileTopNav, SidebarPanel, type AccountUser } from "../infinite-table/account-components";

interface ModelsClientProps {
  initialFavoritesData?: ModelsColumnSchema[];
  initialFavoriteKeys?: ModelFavoriteKey[];
}

export function ModelsClient({ initialFavoritesData, initialFavoriteKeys }: ModelsClientProps = {}) {
  const contentRef = React.useRef<HTMLTableSectionElement>(null);
  const [search] = useQueryStates(modelsSearchParamsParser);
  const queryClient = useQueryClient();
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { showSignIn, showSignUp } = useAuthDialog();
  const [isSigningOut, startSignOutTransition] = React.useTransition();
  const accountUser = (session?.user ?? null) as AccountUser | null;

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

  const isFavoritesMode = !!initialFavoritesData;

  const initializedRef = React.useRef(false);
  React.useEffect(() => {
    if (!initializedRef.current && initialFavoriteKeys) {
      queryClient.setQueryData(MODEL_FAVORITES_QUERY_KEY, initialFavoriteKeys);
      initializedRef.current = true;
    }
  }, [initialFavoriteKeys, queryClient]);

  const { data: favorites = [] } = useQuery({
    queryKey: MODEL_FAVORITES_QUERY_KEY,
    queryFn: getModelFavorites,
    staleTime: Infinity,
    enabled: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  React.useEffect(() => {
    if (!isFavoritesMode) return;
    const bc = new BroadcastChannel(MODEL_FAVORITES_BROADCAST_CHANNEL);
    bc.onmessage = (event) => {
      if (event.data?.type === "updated" && Array.isArray(event.data?.favorites)) {
        const newFavorites = event.data.favorites as ModelFavoriteKey[];
        queryClient.setQueryData(MODEL_FAVORITES_QUERY_KEY, newFavorites);
      }
    };
    return () => bc.close();
  }, [isFavoritesMode, queryClient]);

  const favoriteKeys = React.useMemo(() => new Set(favorites as ModelFavoriteKey[]), [favorites]);

  const [favoritesData, setFavoritesData] = React.useState(initialFavoritesData);
  React.useEffect(() => {
    setFavoritesData(initialFavoritesData);
  }, [initialFavoritesData]);

  React.useEffect(() => {
    if (isFavoritesMode && initialFavoritesData) {
      const updated = initialFavoritesData.filter((row) => favoriteKeys.has(stableModelKey(row)));
      setFavoritesData(updated);
    }
  }, [favorites, favoriteKeys, isFavoritesMode, initialFavoritesData]);

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
      return (favoritesData || initialFavoritesData || []) as ModelsColumnSchema[];
    }
    return (data?.pages?.flatMap((page) => page.data ?? []) as ModelsColumnSchema[]) ?? [] as ModelsColumnSchema[];
  }, [data?.pages, isFavoritesMode, favoritesData, initialFavoritesData]);

  const lastPage = data?.pages?.[data?.pages.length - 1];
  const rawFacets = isFavoritesMode ? {} : lastPage?.meta?.facets;
  const facetsRef = React.useRef<Record<string, ModelsFacetMetadataSchema> | undefined>(undefined);
  React.useEffect(() => {
    if (rawFacets && Object.keys(rawFacets).length) {
      facetsRef.current = rawFacets;
    }
  }, [rawFacets]);
  const stableFacets = React.useMemo(() => {
    if (isFavoritesMode) return {};
    return rawFacets && Object.keys(rawFacets).length ? rawFacets : facetsRef.current ?? {};
  }, [rawFacets, isFavoritesMode]);
  const castFacets = stableFacets as Record<string, ModelsFacetMetadataSchema> | undefined;
  const totalDBRowCount = isFavoritesMode ? flatData.length : lastPage?.meta?.totalRowCount;
  const filterDBRowCount = isFavoritesMode ? flatData.length : lastPage?.meta?.filterRowCount;
  const totalFetched = flatData.length;

  const metadata = {
    ...(lastPage?.meta?.metadata ?? {}),
    initialFavoriteKeys,
  } as Record<string, unknown>;

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

  React.useEffect(() => {
    if (!isSortingStateEqual(derivedSortingRef.current, derivedSorting)) {
      setSorting(derivedSorting);
    }
    derivedSortingRef.current = derivedSorting;
  }, [derivedSorting]);

  React.useEffect(() => {
    if (sorting.length > 0) {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
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
      key={`models-table-${isFavoritesMode ? `favorites-${favorites?.length || 0}` : "all"}`}
      columns={modelsColumns}
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
      meta={{ ...metadata, facets: castFacets }}
      filterFields={filterFields}
      sheetFields={sheetFields}
      isFetching={isFavoritesMode ? false : isFetching}
      isLoading={isFavoritesMode ? false : isLoading}
      isFetchingNextPage={isFavoritesMode ? false : isFetchingNextPage}
      fetchNextPage={isFavoritesMode ? () => Promise.resolve() : fetchNextPage}
      hasNextPage={isFavoritesMode ? false : hasNextPage}
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
              hideNavigation
            />
          )}
        />
      }
      mobileHeaderOffset="38px+1rem"
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
