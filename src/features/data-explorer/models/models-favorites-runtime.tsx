"use client";

import { useFavoritesRuntime } from "@/features/data-explorer/favorites/use-favorites-runtime";
import { stableModelKey } from "@/features/data-explorer/stable-keys";
import type { Session } from "@/lib/auth-client";
import {
  MODEL_FAVORITES_BROADCAST_CHANNEL,
  MODEL_FAVORITES_QUERY_KEY,
} from "@/lib/model-favorites/constants";
import { syncModelFavorites } from "@/lib/model-favorites/sync";
import type { ModelFavoriteKey } from "@/types/model-favorites";
import { favoritesDataOptions } from "./models-favorites-query-options";
import type { ModelsInfiniteQueryResponse, ModelsLogsMeta } from "./models-query-options";
import type { ModelsSearchParamsType } from "./models-search-params";
import type { ModelsColumnSchema } from "./models-schema";

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
  useFavoritesRuntime<ModelsColumnSchema, ModelFavoriteKey>({
    search,
    isActive,
    session,
    authPending,
    onStateChange,
    broadcastId,
    favoritesDataOptions: () => favoritesDataOptions(search),
    favoritesQueryKey: MODEL_FAVORITES_QUERY_KEY,
    rowsQueryKey: ["model-favorites", "rows"],
    broadcastChannel: MODEL_FAVORITES_BROADCAST_CHANNEL,
    syncFavorites: syncModelFavorites,
    stableKey: stableModelKey,
  });

  return null;
}
