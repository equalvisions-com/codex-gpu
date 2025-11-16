"use client";

import * as React from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { FavoritesRuntimeSnapshot } from "../favorites-runtime";
import { syncFavorites } from "@/lib/favorites/sync";

interface UseFavoritesStateOptions {
  initialFavoriteKeys?: string[];
  effectiveFavoritesMode: boolean;
  queryClient: QueryClient;
}

interface UseFavoritesStateResult {
  favoritesSnapshot: FavoritesRuntimeSnapshot | null;
  handleFavoritesSnapshot: (snapshot: FavoritesRuntimeSnapshot | null) => void;
  shouldHydrateFavorites: boolean;
}

export function useFavoritesState({
  initialFavoriteKeys,
  effectiveFavoritesMode,
  queryClient,
}: UseFavoritesStateOptions): UseFavoritesStateResult {
  const [favoritesSnapshot, setFavoritesSnapshot] =
    React.useState<FavoritesRuntimeSnapshot | null>(null);
  const initializedRef = React.useRef(false);

  React.useEffect(() => {
    if (!initializedRef.current && initialFavoriteKeys?.length) {
      syncFavorites({
        queryClient,
        favorites: initialFavoriteKeys,
        invalidateRows: false,
      });
      initializedRef.current = true;
    }
  }, [initialFavoriteKeys, queryClient]);

  const handleFavoritesSnapshot = React.useCallback(
    (snapshot: FavoritesRuntimeSnapshot | null) => {
      setFavoritesSnapshot(snapshot);
    },
    [],
  );

  return {
    favoritesSnapshot,
    handleFavoritesSnapshot,
    shouldHydrateFavorites: effectiveFavoritesMode,
  };
}
