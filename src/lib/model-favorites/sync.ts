import type { QueryClient } from "@tanstack/react-query";
import type { ModelFavoriteKey } from "@/types/model-favorites";
import { MODEL_FAVORITES_QUERY_KEY } from "./constants";

interface SyncModelFavoritesOptions {
  queryClient: QueryClient;
  favorites: ModelFavoriteKey[];
  setLocalFavorites?: (favorites: ModelFavoriteKey[]) => void;
  broadcastChannel?: BroadcastChannel | null;
  broadcast?: boolean;
  invalidateRows?: boolean;
}

export function syncModelFavorites({
  queryClient,
  favorites,
  setLocalFavorites,
  broadcastChannel,
  broadcast = false,
  invalidateRows = false,
}: SyncModelFavoritesOptions) {
  queryClient.setQueryData(MODEL_FAVORITES_QUERY_KEY, favorites);
  setLocalFavorites?.(favorites);

  if (invalidateRows) {
    void queryClient.invalidateQueries({ queryKey: ["model-favorites", "rows"] });
  }

  if (broadcast && broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: "updated", favorites });
    } catch (error) {
      console.warn("[syncModelFavorites] Broadcast failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
