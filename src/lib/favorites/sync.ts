import type { QueryClient } from "@tanstack/react-query";
import type { FavoriteKey } from "@/types/favorites";
import { FAVORITES_QUERY_KEY } from "./constants";

interface SyncFavoritesOptions {
  queryClient: QueryClient;
  favorites: FavoriteKey[];
  setLocalFavorites?: (favorites: FavoriteKey[]) => void;
  broadcastChannel?: BroadcastChannel | null;
  broadcast?: boolean;
  invalidateRows?: boolean;
}

export function syncFavorites({
  queryClient,
  favorites,
  setLocalFavorites,
  broadcastChannel,
  broadcast = false,
  invalidateRows = false,
}: SyncFavoritesOptions) {
  queryClient.setQueryData(FAVORITES_QUERY_KEY, favorites);
  setLocalFavorites?.(favorites);

  if (invalidateRows) {
    void queryClient.invalidateQueries({ queryKey: ["favorites", "rows"] });
  }

  if (broadcast && broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: "updated", favorites });
    } catch (error) {
      console.warn("[syncFavorites] Broadcast failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

