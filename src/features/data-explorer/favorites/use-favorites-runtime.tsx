"use client";

import * as React from "react";
import {
  type QueryClient,
  type UseInfiniteQueryOptions,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { Session } from "@/lib/auth-client";

export interface FavoritesRuntimeSnapshot<
  TData,
  TFavoriteKey
> {
  flatData: TData[];
  lastPage?: { meta?: { totalRowCount?: number; filterRowCount?: number } };
  totalRowCount: number;
  filterRowCount: number;
  totalFetched: number;
  isFetching: boolean;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  hasNextPage: boolean;
  isFavoritesLoading: boolean;
  favoriteKeysFromRows: TFavoriteKey[];
}

interface UseFavoritesRuntimeParams<
  TData,
  TFavoriteKey
> {
  search?: unknown;
  isActive: boolean;
  session: Session | null;
  authPending: boolean;
  onStateChange: (
    snapshot: FavoritesRuntimeSnapshot<TData, TFavoriteKey> | null
  ) => void;
  broadcastId: string;
  favoritesDataOptions: () => UseInfiniteQueryOptions<
    { data?: TData[]; meta?: { totalRowCount?: number; filterRowCount?: number } },
    Error,
    { data?: TData[]; meta?: { totalRowCount?: number; filterRowCount?: number } }
  >;
  favoritesQueryKey: readonly unknown[];
  rowsQueryKey: readonly unknown[];
  broadcastChannel: string;
  syncFavorites: (options: {
    queryClient: QueryClient;
    favorites: TFavoriteKey[];
  }) => void;
  stableKey: (row: TData) => TFavoriteKey;
}

export function useFavoritesRuntime<
  TData,
  TFavoriteKey
>({
  search: _search,
  isActive,
  session,
  authPending,
  onStateChange,
  broadcastId,
  favoritesDataOptions,
  favoritesQueryKey,
  rowsQueryKey,
  broadcastChannel,
  syncFavorites,
  stableKey,
}: UseFavoritesRuntimeParams<TData, TFavoriteKey>) {
  void _search;
  const queryClient = useQueryClient();
  const favoritesEnabled = isActive && !!session && !authPending;

  const {
    data: favoriteData,
    isFetching,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    status,
  } = useInfiniteQuery({
    ...favoritesDataOptions(),
    enabled: favoritesEnabled,
  });

  const pages = React.useMemo(() => {
    return (
      favoriteData?.pages ??
      ([] as Array<{
        data?: TData[];
        meta?: { totalRowCount?: number; filterRowCount?: number };
      }>)
    );
  }, [favoriteData]);

  const flatData = React.useMemo(() => {
    return pages.flatMap((page) => page.data ?? []);
  }, [pages]);

  const lastPage = pages[pages.length - 1];
  const totalRowCount = lastPage?.meta?.totalRowCount ?? flatData.length;
  const filterRowCount = lastPage?.meta?.filterRowCount ?? flatData.length;
  const totalFetched = flatData.length;

  const favoriteKeysFromRows = React.useMemo(() => {
    if (!pages.length) {
      return [];
    }
    const keys = new Set<TFavoriteKey>();
    pages.forEach((page) => {
      page.data?.forEach((row) => {
        keys.add(stableKey(row));
      });
    });
    return Array.from(keys);
  }, [pages, stableKey]);

  const isFavoritesLoading =
    isLoading || status === "pending" || (isActive && (authPending || !session));

  const snapshot = React.useMemo<
    FavoritesRuntimeSnapshot<TData, TFavoriteKey>
  >(() => {
    return {
      flatData,
      lastPage,
      totalRowCount,
      filterRowCount,
      totalFetched,
      isFetching,
      isLoading,
      isFetchingNextPage,
      fetchNextPage,
      hasNextPage: Boolean(hasNextPage),
      isFavoritesLoading,
      favoriteKeysFromRows,
    };
  }, [
    favoriteKeysFromRows,
    fetchNextPage,
    filterRowCount,
    flatData,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isFavoritesLoading,
    isLoading,
    lastPage,
    totalFetched,
    totalRowCount,
  ]);

  React.useEffect(() => {
    onStateChange(snapshot);
  }, [onStateChange, snapshot]);

  React.useEffect(() => {
    return () => {
      onStateChange(null);
    };
  }, [onStateChange]);

  React.useEffect(() => {
    if (!isActive || favoriteKeysFromRows.length === 0) {
      return;
    }
    const existing = queryClient.getQueryData<TFavoriteKey[]>(favoritesQueryKey);
    if (!existing || existing.length !== favoriteKeysFromRows.length) {
      queryClient.setQueryData(favoritesQueryKey, favoriteKeysFromRows);
    }
  }, [favoriteKeysFromRows, favoritesQueryKey, isActive, queryClient]);

  React.useEffect(() => {
    if (!isActive) {
      return;
    }
    void queryClient.invalidateQueries({
      queryKey: rowsQueryKey,
      exact: false,
    });
  }, [isActive, queryClient, rowsQueryKey]);

  React.useEffect(() => {
    if (!isActive) {
      return;
    }
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
      return;
    }

    const bc = new BroadcastChannel(broadcastChannel);
    const timeoutIds: NodeJS.Timeout[] = [];

    bc.onmessage = (event) => {
      if (event.data?.type !== "updated" || !Array.isArray(event.data?.favorites)) {
        return;
      }
      if (event.data?.source === broadcastId) {
        return;
      }

      const newFavorites = event.data.favorites as TFavoriteKey[];

      syncFavorites({
        queryClient,
        favorites: newFavorites,
      });

      void queryClient.invalidateQueries({
        queryKey: rowsQueryKey,
        exact: false,
      });

      const timeoutId = setTimeout(() => {
        void queryClient.refetchQueries({
          queryKey: rowsQueryKey,
          exact: false,
          type: "active",
        });
      }, 100);
      timeoutIds.push(timeoutId);
    };

    return () => {
      bc.close();
      timeoutIds.forEach(clearTimeout);
    };
  }, [
    broadcastChannel,
    broadcastId,
    isActive,
    queryClient,
    rowsQueryKey,
    syncFavorites,
  ]);

  return snapshot;
}
