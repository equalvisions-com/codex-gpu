"use client";

import * as React from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@/lib/auth-client";
import { favoritesDataOptions } from "./models-favorites-query-options";
import type { ModelsSearchParamsType } from "./models-search-params";
import type { ModelsColumnSchema } from "./models-schema";
import type { ModelFavoriteKey } from "@/types/model-favorites";
import {
  MODEL_FAVORITES_BROADCAST_CHANNEL,
  MODEL_FAVORITES_QUERY_KEY,
} from "@/lib/model-favorites/constants";
import { syncModelFavorites } from "@/lib/model-favorites/sync";
import { stableModelKey } from "./stable-key";
import type { ModelsInfiniteQueryResponse, ModelsLogsMeta } from "./models-query-options";

const EMPTY_PAGES: ModelsInfiniteQueryResponse<ModelsColumnSchema[], ModelsLogsMeta>[] = [];

export interface FavoritesRuntimeSnapshot {
  flatData: ModelsColumnSchema[];
  lastPage?: ModelsInfiniteQueryResponse<ModelsColumnSchema[], ModelsLogsMeta>;
  totalRowCount: number;
  filterRowCount: number;
  totalFetched: number;
  isFetching: boolean;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  hasNextPage: boolean;
  isFavoritesLoading: boolean;
  favoriteKeysFromRows: ModelFavoriteKey[];
}

interface ModelsFavoritesRuntimeProps {
  search: ModelsSearchParamsType;
  isActive: boolean;
  session: Session | null;
  authPending: boolean;
  onStateChange: (snapshot: FavoritesRuntimeSnapshot | null) => void;
  broadcastId: string;
}

export default function ModelsFavoritesRuntime({
  search,
  isActive,
  session,
  authPending,
  onStateChange,
  broadcastId,
}: ModelsFavoritesRuntimeProps) {
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
    return pages.flatMap((page) => page.data ?? []) as ModelsColumnSchema[];
  }, [pages]);
  const lastPage = pages[pages.length - 1];
  const totalRowCount = lastPage?.meta?.totalRowCount ?? flatData.length;
  const filterRowCount = lastPage?.meta?.filterRowCount ?? flatData.length;
  const totalFetched = flatData.length;

  const favoriteKeysFromRows = React.useMemo(() => {
    if (!pages.length) {
      return [];
    }
    const allKeys = new Set<ModelFavoriteKey>();
    pages.forEach((page) => {
      page.data.forEach((row) => {
        allKeys.add(stableModelKey(row) as ModelFavoriteKey);
      });
    });
    return Array.from(allKeys);
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
    const existing = queryClient.getQueryData<ModelFavoriteKey[]>(MODEL_FAVORITES_QUERY_KEY);
    if (!existing || existing.length !== favoriteKeysFromRows.length) {
      queryClient.setQueryData(MODEL_FAVORITES_QUERY_KEY, favoriteKeysFromRows);
    }
  }, [favoriteKeysFromRows, isActive, queryClient]);

  React.useEffect(() => {
    if (!isActive) {
      return;
    }
    void queryClient.invalidateQueries({
      queryKey: ["model-favorites", "rows"],
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

    const bc = new BroadcastChannel(MODEL_FAVORITES_BROADCAST_CHANNEL);
    const timeoutIds: NodeJS.Timeout[] = [];

    bc.onmessage = (event) => {
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

      void queryClient.invalidateQueries({
        queryKey: ["model-favorites", "rows"],
        exact: false,
      });

      const timeoutId = setTimeout(() => {
        void queryClient.refetchQueries({
          queryKey: ["model-favorites", "rows"],
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
