"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useDataTable } from "@/components/data-table/data-table-provider";
import { Button } from "@/components/ui/button";
import { Star, GitCompare, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
// No Sonner toasts for favorites flows; use inline notice instead
import { useEphemeralNotice } from "@/hooks/use-ephemeral-notice";
import { FavoritesNotice } from "../infinite-table/_components/favorites-notice";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { CpuColumnSchema } from "./cpu-schema";
import type { FavoriteKey } from "@/types/favorites";
import { stableCpuKey } from "@/lib/favorites/cpu-stable-key";
import {
  FAVORITES_QUERY_KEY,
  FAVORITES_BROADCAST_CHANNEL,
} from "@/lib/favorites/constants";
import {
  getCpuFavorites,
  addCpuFavorites,
  removeCpuFavorites,
  CpuFavoritesAPIError
} from "@/lib/favorites/cpu-api-client";
import { useAuthDialog } from "@/providers/auth-dialog-provider";
import { useAuth } from "@/providers/auth-client-provider";

export function CpuCheckedActionsIsland({ initialFavoriteKeys }: { initialFavoriteKeys?: FavoriteKey[] }) {
  const { checkedRows, table, toggleCheckedRow } = useDataTable<CpuColumnSchema, unknown>();
  const queryClient = useQueryClient();
  const bcRef = React.useRef<BroadcastChannel | null>(null);
  const isMountedRef = React.useRef(true);
  const { message: favoritesNotice, isOpen: isFavoritesOpen, show: showFavoritesNotice } = useEphemeralNotice(1600);
  const [noticeVariant, setNoticeVariant] = React.useState<"success" | "error">("success");
  const { showSignIn } = useAuthDialog();
  const { session, isPending: authPending } = useAuth();
  const promptForAuth = React.useCallback(() => {
    const callbackUrl =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "/";
    showSignIn({ callbackUrl });
  }, [showSignIn]);

  // Cleanup flag (other timers are handled in the hook)
  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Only show and fetch favorites when the user actually selects rows
  const hasSelection = React.useMemo(() => {
    for (const _ in checkedRows) return true;
    return false;
  }, [checkedRows]);

  /**
   * Fetch favorites when needed: no SSR cache + user selects row
   * Uses centralized API client with timeout and error handling
   */
  const { data: favorites = [] } = useQuery({
    queryKey: FAVORITES_QUERY_KEY,
    queryFn: getCpuFavorites,
    staleTime: Infinity,
    enabled: !initialFavoriteKeys && hasSelection,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  /**
   * Initialize query cache with SSR data for optimistic updates to work
   * Only initializes if cache is empty to prevent overwriting optimistic updates
   */
  React.useEffect(() => {
    const existingData = queryClient.getQueryData<FavoriteKey[]>(FAVORITES_QUERY_KEY);
    if (!existingData && initialFavoriteKeys) {
      queryClient.setQueryData(FAVORITES_QUERY_KEY, initialFavoriteKeys);
    }
  }, [initialFavoriteKeys, queryClient]);

  // Local optimistic snapshot to ensure instant UI even if a fetch is in flight
  const [localFavorites, setLocalFavorites] = React.useState<FavoriteKey[] | undefined>(initialFavoriteKeys);
  const prevFavoritesRef = React.useRef<string>('');
  React.useEffect(() => {
    if (Array.isArray(favorites)) {
      const favoritesArray = favorites as FavoriteKey[];
      const favoritesString = JSON.stringify(favoritesArray);
      // Only update if the arrays are actually different to prevent infinite loops
      if (prevFavoritesRef.current !== favoritesString) {
        setLocalFavorites(favoritesArray);
        prevFavoritesRef.current = favoritesString;
      }
    }
  }, [favorites]);

  /**
   * Cross-tab synchronization for CPU favorites
   * Receives favorites data directly from other tabs (no API call)
   * This optimizes multi-tab scenarios by avoiding redundant server requests
   */
  React.useEffect(() => {
    if (!bcRef.current) {
      bcRef.current = new BroadcastChannel(FAVORITES_BROADCAST_CHANNEL);
    }
    const bc = bcRef.current;

    bc.onmessage = (event) => {
      if (event.data?.type === "updated" && Array.isArray(event.data?.favorites)) {
        const newFavorites = event.data.favorites as FavoriteKey[];
        // Update local favorites immediately for instant UI feedback
        setLocalFavorites(newFavorites);
        // Update query cache for consistency
        queryClient.setQueryData(FAVORITES_QUERY_KEY, newFavorites);
      }
    };

    return () => {
      if (bcRef.current) {
        bcRef.current.close();
        bcRef.current = null;
      }
    };
  }, [queryClient]);

  // Use local favorites if available, otherwise fall back to query data
  const currentFavorites = localFavorites ?? favorites;

  // Convert favorites array to Set for O(1) lookup performance
  const favoriteKeys = React.useMemo(() => new Set(currentFavorites as FavoriteKey[]), [currentFavorites]);

  // Calculate which checked rows are already favorited
  const checkedRowIds = React.useMemo(() => Object.keys(checkedRows), [checkedRows]);
  const checkedRowsData = React.useMemo(() => {
    return checkedRowIds
      .map(id => table.getRowModel().rows.find(row => row.id === id)?.original)
      .filter(Boolean) as CpuColumnSchema[];
  }, [checkedRowIds, table]);

  const checkedFavoritedCount = React.useMemo(() => {
    return checkedRowsData.filter(row => favoriteKeys.has(stableCpuKey(row))).length;
  }, [checkedRowsData, favoriteKeys]);

  const checkedNotFavoritedCount = checkedRowsData.length - checkedFavoritedCount;

  // Determine action type based on current state
  const actionType = checkedFavoritedCount > checkedNotFavoritedCount ? "unfavorite" : "favorite";

  // Only show island when there are checked rows
  if (!hasSelection) return null;

  const handleFavoriteAction = async () => {
    if (!session && !authPending) {
      promptForAuth();
      return;
    }

    if (authPending) return;

    const uuidsToProcess = checkedRowsData
      .filter(row => {
        const isFavorited = favoriteKeys.has(stableCpuKey(row));
        return actionType === "favorite" ? !isFavorited : isFavorited;
      })
      .map(row => row.uuid);

    if (uuidsToProcess.length === 0) return;

    // Optimistic update - update local state immediately
    const newFavorites = actionType === "favorite"
      ? [...currentFavorites, ...uuidsToProcess]
      : currentFavorites.filter(uuid => !uuidsToProcess.includes(uuid));

    setLocalFavorites(newFavorites);
    queryClient.setQueryData(FAVORITES_QUERY_KEY, newFavorites);

    // Broadcast to other tabs
    if (bcRef.current) {
      bcRef.current.postMessage({
        type: "updated",
        favorites: newFavorites,
      });
    }

    try {
      if (actionType === "favorite") {
        await addCpuFavorites(uuidsToProcess);
      } else {
        await removeCpuFavorites(uuidsToProcess);
      }

      showFavoritesNotice(actionType === "favorite" ? "Added to favorites" : "Removed from favorites");
      setNoticeVariant("success");

      // Clear selection after successful operation
      checkedRowIds.forEach(id => toggleCheckedRow(id, false));
    } catch (error) {
      // Revert optimistic update on error
      setLocalFavorites(currentFavorites);
      queryClient.setQueryData(FAVORITES_QUERY_KEY, currentFavorites);

      // Broadcast revert to other tabs
      if (bcRef.current) {
        bcRef.current.postMessage({
          type: "updated",
          favorites: currentFavorites,
        });
      }

      if (error instanceof CpuFavoritesAPIError && error.code === "RATE_LIMIT") {
        setNoticeVariant("error");
        showFavoritesNotice(actionType === "favorite" ? "Added to favorites" : "Removed from favorites");
      } else {
        logger.error(`Failed to ${actionType} CPU favorites`, {
          error: error instanceof Error ? error.message : String(error),
          count: uuidsToProcess.length,
        });
      }
    }
  };

  const handleCompare = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("compare", checkedRowIds.join(","));
    window.open(url.toString(), "_blank");
  };

  // Calculate position for the floating island
  const container = document.querySelector('[data-table-container]');
  if (!container) return null;

  const rect = container.getBoundingClientRect();
  const scrollTop = window.scrollY || document.documentElement.scrollTop;

  return createPortal(
    <div
      className={cn(
        "fixed z-50 flex items-center gap-2 rounded-lg border bg-background p-3 shadow-lg transition-all duration-200",
        "left-1/2 top-0 -translate-x-1/2 -translate-y-full",
      )}
      style={{
        top: rect.top + scrollTop - 16,
      }}
    >
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <span>{checkedRowsData.length} selected</span>
      </div>

      <div className="flex items-center gap-1">
        <HoverCard>
          <HoverCardTrigger asChild>
            <Button
              size="sm"
              variant={actionType === "favorite" ? "default" : "outline"}
              onClick={handleFavoriteAction}
              disabled={authPending}
              className="gap-1.5"
            >
              <Star className="h-3.5 w-3.5" />
              {actionType === "favorite" ? "Favorite" : "Unfavorite"}
            </Button>
          </HoverCardTrigger>
          <HoverCardContent side="top" className="w-64">
            <div className="space-y-2">
              <p className="text-sm">
                {actionType === "favorite"
                  ? `Add ${checkedNotFavoritedCount} CPU${checkedNotFavoritedCount !== 1 ? 's' : ''} to favorites`
                  : `Remove ${checkedFavoritedCount} CPU${checkedFavoritedCount !== 1 ? 's' : ''} from favorites`
                }
              </p>
              {checkedFavoritedCount > 0 && checkedNotFavoritedCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  Mixed selection: {checkedFavoritedCount} favorited, {checkedNotFavoritedCount} not favorited
                </p>
              )}
            </div>
          </HoverCardContent>
        </HoverCard>

        <Button size="sm" variant="outline" onClick={handleCompare} className="gap-1.5">
          <GitCompare className="h-3.5 w-3.5" />
          Compare
        </Button>
      </div>

      {/* Favorites notice */}
      <FavoritesNotice
        message={favoritesNotice}
        open={isFavoritesOpen}
        variant={noticeVariant}
      />
    </div>,
    document.body,
  );
}
