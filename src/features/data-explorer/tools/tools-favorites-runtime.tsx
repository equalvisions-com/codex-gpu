"use client";

import { useFavoritesRuntime, type FavoritesDataOptions } from "@/features/data-explorer/favorites/use-favorites-runtime";
import type { ToolColumnSchema } from "./tools-schema";
import type { ToolFavoriteKey } from "@/types/tool-favorites";
import type {
  ToolInfiniteQueryResponse,
  ToolLogsMeta,
} from "./tools-query-options";
import type { ToolsSearchParamsType } from "./tools-search-params";
import { toolFavoritesDataOptions } from "./favorites-query-options";
import {
  TOOL_FAVORITES_BROADCAST_CHANNEL,
  TOOL_FAVORITES_QUERY_KEY,
} from "@/lib/tool-favorites/constants";
import { syncToolFavorites } from "@/lib/tool-favorites/sync";
import { stableToolKey } from "@/features/data-explorer/stable-keys";
import type { Session } from "@/lib/auth-client";

export interface ToolFavoritesRuntimeSnapshot {
  flatData: ToolColumnSchema[];
  lastPage?: ToolInfiniteQueryResponse<ToolColumnSchema[], ToolLogsMeta>;
  totalRowCount: number;
  filterRowCount: number;
  totalFetched: number;
  isFetching: boolean;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  hasNextPage: boolean;
  isFavoritesLoading: boolean;
  favoriteKeysFromRows: ToolFavoriteKey[];
}

interface ToolFavoritesRuntimeProps {
  search: ToolsSearchParamsType;
  isActive: boolean;
  session: Session | null;
  authPending: boolean;
  onStateChange: (snapshot: ToolFavoritesRuntimeSnapshot | null) => void;
  broadcastId: string;
}

export default function ToolFavoritesRuntime({
  search,
  isActive,
  session,
  authPending,
  onStateChange,
  broadcastId,
}: ToolFavoritesRuntimeProps) {
  useFavoritesRuntime<
    ToolColumnSchema,
    ToolFavoriteKey,
    ToolInfiniteQueryResponse<ToolColumnSchema[], ToolLogsMeta>,
    { cursor: number | null; size: number },
    ToolInfiniteQueryResponse<ToolColumnSchema[], ToolLogsMeta>
  >({
    search,
    isActive,
    session,
    authPending,
    onStateChange,
    broadcastId,
    favoritesDataOptions: () =>
      toolFavoritesDataOptions(search) as ReturnType<
        FavoritesDataOptions<
          ToolInfiniteQueryResponse<ToolColumnSchema[], ToolLogsMeta>,
          { cursor: number | null; size: number }
        >
      >,
    favoritesQueryKey: TOOL_FAVORITES_QUERY_KEY,
    rowsQueryKey: ["tool-favorites", "rows"],
    broadcastChannel: TOOL_FAVORITES_BROADCAST_CHANNEL,
    syncFavorites: syncToolFavorites,
    stableKey: stableToolKey,
  });

  return null;
}
