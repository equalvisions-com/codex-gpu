"use client";

import * as React from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { ToolFavoritesRuntimeSnapshot } from "../tools-favorites-runtime";
import { syncToolFavorites } from "@/lib/tool-favorites/sync";
import type { ToolFavoriteKey } from "@/types/tool-favorites";

interface UseToolsFavoritesStateOptions {
  initialFavoriteKeys?: ToolFavoriteKey[];
  effectiveFavoritesMode: boolean;
  queryClient: QueryClient;
}

interface UseToolsFavoritesStateResult {
  favoritesSnapshot: ToolFavoritesRuntimeSnapshot | null;
  handleFavoritesSnapshot: (snapshot: ToolFavoritesRuntimeSnapshot | null) => void;
  shouldHydrateFavorites: boolean;
}

export function useToolsFavoritesState({
  initialFavoriteKeys,
  effectiveFavoritesMode,
  queryClient,
}: UseToolsFavoritesStateOptions): UseToolsFavoritesStateResult {
  const [favoritesSnapshot, setFavoritesSnapshot] =
    React.useState<ToolFavoritesRuntimeSnapshot | null>(null);
  const initializedRef = React.useRef(false);

  React.useEffect(() => {
    if (!initializedRef.current && initialFavoriteKeys?.length) {
      syncToolFavorites({
        queryClient,
        favorites: initialFavoriteKeys,
        invalidateRows: false,
      });
      initializedRef.current = true;
    }
  }, [initialFavoriteKeys, queryClient]);

  const handleFavoritesSnapshot = React.useCallback(
    (snapshot: ToolFavoritesRuntimeSnapshot | null) => {
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
