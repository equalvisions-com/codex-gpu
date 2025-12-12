import type { QueryClient } from "@tanstack/react-query";
import type { ToolFavoriteKey } from "@/types/tool-favorites";
import { TOOL_FAVORITES_QUERY_KEY } from "./constants";

interface SyncToolFavoritesOptions {
  queryClient: QueryClient;
  favorites: ToolFavoriteKey[];
  setLocalFavorites?: (favorites: ToolFavoriteKey[]) => void;
  broadcastChannel?: BroadcastChannel | null;
  broadcast?: boolean;
  invalidateRows?: boolean;
}

export function syncToolFavorites({
  queryClient,
  favorites,
  setLocalFavorites,
  broadcastChannel,
  broadcast = false,
  invalidateRows = false,
}: SyncToolFavoritesOptions) {
  queryClient.setQueryData(TOOL_FAVORITES_QUERY_KEY, favorites);
  setLocalFavorites?.(favorites);

  if (invalidateRows) {
    void queryClient.invalidateQueries({ queryKey: ["tool-favorites", "rows"] });
  }

  if (broadcast && broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: "updated", favorites });
    } catch (error) {
      console.warn("[syncToolFavorites] Broadcast failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
