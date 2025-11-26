"use client";

import * as React from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@/lib/auth-client";
import { favoritesDataOptions } from "./favorites-query-options";
import type { SearchParamsType } from "./search-params";
import type { RowWithId } from "@/types/api";
import type { FavoriteKey } from "@/types/favorites";
import {
  FAVORITES_BROADCAST_CHANNEL,
  FAVORITES_QUERY_KEY,
} from "@/lib/favorites/constants";
import { syncFavorites } from "@/lib/favorites/sync";
import { stableGpuKey } from "./stable-key";
import type { InfiniteQueryResponse, LogsMeta } from "./query-options";

const EMPTY_PAGES: InfiniteQueryResponse<RowWithId[], LogsMeta>[] = [];

export interface FavoritesRuntimeSnapshot {
  flatData: RowWithId[];
  lastPage?: InfiniteQueryResponse<RowWithId[], LogsMeta>;
  totalRowCount: number;
  filterRowCount: number;
  totalFetched: number;
  isFetching: boolean;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  hasNextPage: boolean;
  isFavoritesLoading: boolean;
  favoriteKeysFromRows: FavoriteKey[];
}

interface FavoritesRuntimeProps {
  search: SearchParamsType;
  isActive: boolean;
  session: Session | null;
  authPending: boolean;
  onStateChange: (snapshot: FavoritesRuntimeSnapshot | null) => void;
  broadcastId: string;
}

export default function FavoritesRuntime({
  search,
  isActive,
  session,
  authPending,
  onStateChange,
  broadcastId,
}: FavoritesRuntimeProps) {
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
    ...favoritesDataOptions(search),
    enabled: favoritesEnabled,
  });

  const pages = favoriteData?.pages ?? EMPTY_PAGES;
  const flatData = React.useMemo(() => {
    return pages.flatMap((page) => page.data ?? []) as RowWithId[];
  }, [pages]);
  const lastPage = pages[pages.length - 1];
  const totalRowCount = lastPage?.meta?.totalRowCount ?? flatData.length;
  const filterRowCount = lastPage?.meta?.filterRowCount ?? flatData.length;
  const totalFetched = flatData.length;

  const favoriteKeysFromRows = React.useMemo(() => {
    if (!pages.length) {
      return [];
    }
    const keys = new Set<FavoriteKey>();
    pages.forEach((page) => {
      page.data.forEach((row) => {
        keys.add(stableGpuKey(row) as FavoriteKey);
      });
    });
    return Array.from(keys);
  }, [pages]);

  const isFavoritesLoading =
    isLoading ||
    status === "pending" ||
    (isActive && (authPending || !session));

  const snapshot = React.useMemo<FavoritesRuntimeSnapshot>(() => {
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
    const existing = queryClient.getQueryData<FavoriteKey[]>(FAVORITES_QUERY_KEY);
    if (!existing || existing.length !== favoriteKeysFromRows.length) {
      queryClient.setQueryData(FAVORITES_QUERY_KEY, favoriteKeysFromRows);
    }
  }, [favoriteKeysFromRows, isActive, queryClient]);

  React.useEffect(() => {
    if (!isActive) {
      return;
    }
    void queryClient.invalidateQueries({
      queryKey: ["favorites", "rows"],
      exact: false,
    });
  }, [isActive, queryClient]);

  React.useEffect(() => {
    if (!isActive) {
      return;
    }
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
      return;
    }

    const bc = new BroadcastChannel(FAVORITES_BROADCAST_CHANNEL);
    const timeoutIds: NodeJS.Timeout[] = [];

    bc.onmessage = (event) => {
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

      void queryClient.invalidateQueries({
        queryKey: ["favorites", "rows"],
        exact: false,
      });

      const timeoutId = setTimeout(() => {
        void queryClient.refetchQueries({
          queryKey: ["favorites", "rows"],
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
  }, [broadcastId, isActive, queryClient]);

  return null;
}
