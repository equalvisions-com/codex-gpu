"use client";

import * as React from "react";
import type { QueryClient } from "@tanstack/react-query";
import { syncModelFavorites } from "@/lib/model-favorites/sync";
import type { FavoritesRuntimeSnapshot } from "../models-favorites-runtime";

interface UseModelsFavoritesStateOptions {
  initialFavoriteKeys?: string[];
  effectiveFavoritesMode: boolean;
  queryClient: QueryClient;
}

interface UseModelsFavoritesStateResult {
  favoritesSnapshot: FavoritesRuntimeSnapshot | null;
  handleFavoritesSnapshot: (snapshot: FavoritesRuntimeSnapshot | null) => void;
  shouldHydrateFavorites: boolean;
}

export function useModelsFavoritesState({
  initialFavoriteKeys,
  effectiveFavoritesMode,
  queryClient,
}: UseModelsFavoritesStateOptions): UseModelsFavoritesStateResult {
  const [favoritesSnapshot, setFavoritesSnapshot] =
    React.useState<FavoritesRuntimeSnapshot | null>(null);
  const initializedRef = React.useRef(false);

  React.useEffect(() => {
    if (!initializedRef.current && initialFavoriteKeys?.length) {
      syncModelFavorites({
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
