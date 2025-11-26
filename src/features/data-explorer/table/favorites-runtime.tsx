"use client";

import { useFavoritesRuntime, type FavoritesDataOptions } from "@/features/data-explorer/favorites/use-favorites-runtime";
import { stableGpuKey } from "@/features/data-explorer/stable-keys";
import type { Session } from "@/lib/auth-client";
import {
  FAVORITES_BROADCAST_CHANNEL,
  FAVORITES_QUERY_KEY,
} from "@/lib/favorites/constants";
import { syncFavorites } from "@/lib/favorites/sync";
import type { FavoriteKey } from "@/types/favorites";
import type { RowWithId } from "@/types/api";
import { favoritesDataOptions } from "./favorites-query-options";
import type { InfiniteQueryResponse, LogsMeta } from "./query-options";
import type { SearchParamsType } from "./search-params";

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
  useFavoritesRuntime<RowWithId, FavoriteKey, InfiniteQueryResponse<RowWithId[], LogsMeta>, { cursor: number | null; size: number }, InfiniteQueryResponse<RowWithId[], LogsMeta>>({
    search,
    isActive,
    session,
    authPending,
    onStateChange,
    broadcastId,
    favoritesDataOptions: () => favoritesDataOptions(search) as ReturnType<FavoritesDataOptions<
      InfiniteQueryResponse<RowWithId[], LogsMeta>,
      { cursor: number | null; size: number }
    >>,
    favoritesQueryKey: FAVORITES_QUERY_KEY,
    rowsQueryKey: ["favorites", "rows"],
    broadcastChannel: FAVORITES_BROADCAST_CHANNEL,
    syncFavorites,
    stableKey: stableGpuKey,
  });

  return null;
}
