"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useDataTable } from "@/components/data-table/data-table-provider";
import { Button } from "@/components/ui/button";
import { Star, GitCompare, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useEphemeralNotice } from "@/hooks/use-ephemeral-notice";
import { FavoritesNotice } from "./favorites-notice";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnSchema } from "@/components/infinite-table/schema";
import type { InfiniteQueryResponse, LogsMeta } from "@/components/infinite-table/query-options";
import type { FavoriteKey } from "@/types/favorites";
import { stableGpuKey } from "@/components/infinite-table/stable-key";
import { 
  FAVORITES_QUERY_KEY, 
  FAVORITES_BROADCAST_CHANNEL,
} from "@/lib/favorites/constants";
import { 
  getFavorites,
  addFavorites,
  removeFavorites,
  FavoritesAPIError
} from "@/lib/favorites/api-client";
import { useAuthDialog } from "@/providers/auth-dialog-provider";
import { useAuth } from "@/providers/auth-client-provider";
import { getFavoritesBroadcastId } from "@/lib/favorites/broadcast";

export function CheckedActionsIsland({ initialFavoriteKeys }: { initialFavoriteKeys?: FavoriteKey[] }) {
  const { checkedRows, table } = useDataTable<ColumnSchema, unknown>();
  const queryClient = useQueryClient();
  const bcRef = React.useRef<BroadcastChannel | null>(null);
  const isMountedRef = React.useRef(true);
  const { message: favoritesNotice, isOpen: isFavoritesOpen, show: showFavoritesNotice } = useEphemeralNotice(1600);
  const [noticeVariant, setNoticeVariant] = React.useState<"success" | "error">("success");
  const { showSignIn } = useAuthDialog();
  const { session, isPending: authPending } = useAuth();
  const broadcastId = React.useMemo(() => getFavoritesBroadcastId(), []);

  const promptForAuth = React.useCallback(() => {
    const callbackUrl =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "/";
    showSignIn({ callbackUrl });
  }, [showSignIn]);

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const flatRows = table.getRowModel().flatRows;
  const visibleRowIds = React.useMemo(() => new Set(flatRows.map((row) => row.id)), [flatRows]);

  const hasSelection = React.useMemo(() => {
    for (const key in checkedRows) {
      if (visibleRowIds.has(key)) {
        return true;
      }
    }
    return false;
  }, [checkedRows, visibleRowIds]);

  // Seed React Query cache with initialFavoriteKeys if provided (from SSR)
  React.useEffect(() => {
    if (initialFavoriteKeys) {
      const existing = queryClient.getQueryData<FavoriteKey[]>(FAVORITES_QUERY_KEY);
      if (!existing) {
        queryClient.setQueryData(FAVORITES_QUERY_KEY, initialFavoriteKeys);
      }
    }
  }, [initialFavoriteKeys, queryClient]);

  const prevFavoritesRef = React.useRef<string>("");
  
  // Initialize localFavorites from initialFavoriteKeys or React Query cache
  // Only seed if data already exists (from SSR or previous query)
  const [localFavorites, setLocalFavorites] = React.useState<FavoriteKey[] | undefined>(() => {
    const cached = queryClient.getQueryData<FavoriteKey[]>(FAVORITES_QUERY_KEY);
    const initial = cached ?? initialFavoriteKeys;
    if (initial) {
      prevFavoritesRef.current = JSON.stringify(initial);
    }
    return initial;
  });

  const { data: favorites = [] } = useQuery({
    queryKey: FAVORITES_QUERY_KEY,
    queryFn: getFavorites,
    staleTime: Infinity,
    enabled: hasSelection,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  React.useEffect(() => {
    if (Array.isArray(favorites)) {
      const favoritesArray = favorites as FavoriteKey[];
      const favoritesString = JSON.stringify(favoritesArray);
      if (prevFavoritesRef.current !== favoritesString) {
        setLocalFavorites(favoritesArray);
        prevFavoritesRef.current = favoritesString;
      }
    }
  }, [favorites]);


  React.useEffect(() => {
    if (authPending) return;
    if (!session) {
      prevFavoritesRef.current = "";
      setLocalFavorites(undefined);
      void queryClient.removeQueries({ queryKey: FAVORITES_QUERY_KEY });
    }
  }, [authPending, queryClient, session]);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
      return;
    }
    const bc = new BroadcastChannel(FAVORITES_BROADCAST_CHANNEL);
    bcRef.current = bc;

    bc.onmessage = (event) => {
      if (event.data?.type === "updated" && Array.isArray(event.data?.favorites)) {
        if (event.data?.source === broadcastId) {
          return;
        }
        const newFavorites = event.data.favorites as FavoriteKey[];
        queryClient.setQueryData(FAVORITES_QUERY_KEY, newFavorites);
        setLocalFavorites(newFavorites);
        if (newFavorites.length === 0) {
          // Clear all favorites queries using partial key match
          queryClient.setQueriesData(
            { queryKey: ["favorites", "rows"], exact: false },
            () => ({
              pages: [],
              pageParams: [],
            })
          );
        } else {
          // Invalidate to refetch with updated favorites
          void queryClient.invalidateQueries({ queryKey: ["favorites", "rows"], exact: false });
        }
      }
    };

    return () => {
      bc.close();
      bcRef.current = null;
    };
  }, [broadcastId, queryClient]);

  const favoriteKeys = React.useMemo(() => {
    const list = (localFavorites && localFavorites.length > 0)
      ? localFavorites
      : (initialFavoriteKeys || []);
    return new Set(list);
  }, [localFavorites, initialFavoriteKeys]);

  const canCompare = React.useMemo(() => {
    let count = 0;
    for (const _ in checkedRows) {
      count++;
      if (count >= 2) return true;
    }
    return false;
  }, [checkedRows]);

  const favoriteStatus = React.useMemo(() => {
    const selectedRowIds = Object.keys(checkedRows);
    const rowById = new Map(table.getRowModel().flatRows.map(r => [r.id, r.original as ColumnSchema]));
    const selectedKeys = selectedRowIds
      .map(id => rowById.get(id))
      .filter(Boolean)
      .map(row => stableGpuKey(row as ColumnSchema));

    const alreadyFavorited = selectedKeys.filter(key => favoriteKeys.has(key));
    const notFavorited = selectedKeys.filter(key => !favoriteKeys.has(key));

    const shouldRemove = alreadyFavorited.length === selectedKeys.length && selectedKeys.length > 0;
    const shouldAdd = notFavorited.length > 0;

    return {
      selectedCount: selectedKeys.length,
      alreadyFavorited: alreadyFavorited.length,
      notFavorited: notFavorited.length,
      toAdd: shouldAdd ? notFavorited : [],
      toRemove: shouldRemove ? alreadyFavorited : [],
      shouldRemove,
      shouldAdd,
    };
  }, [checkedRows, favoriteKeys, table]);

  const [isMutating, setIsMutating] = React.useState(false);

  const FAVORITES_CHUNK_SIZE = 200;

  const fetchFavoriteRowsByKeys = React.useCallback(async (keys: FavoriteKey[]) => {
    if (!keys.length) return [] as ColumnSchema[];

    const uniqueKeys = Array.from(new Set(keys));
    const rowsByKey = new Map<string, ColumnSchema>();

    for (let index = 0; index < uniqueKeys.length; index += FAVORITES_CHUNK_SIZE) {
      const chunk = uniqueKeys.slice(index, index + FAVORITES_CHUNK_SIZE);
      const response = await fetch("/api/favorites/rows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ keys: chunk }),
      });

      if (!response.ok) {
        throw new Error("Failed to load favorite rows");
      }

      const json = (await response.json()) as { rows: ColumnSchema[] };
      for (const row of json.rows ?? []) {
        rowsByKey.set(row.uuid, row);
        rowsByKey.set(stableGpuKey(row), row);
      }
    }

    return keys
      .map((key) => rowsByKey.get(key))
      .filter((row): row is ColumnSchema => Boolean(row));
  }, []);

  const handleFavorite = async () => {
    if (!hasSelection) return;
    if (!session) {
      promptForAuth();
      return;
    }
    if (isMutating) return;
    setIsMutating(true);

    const { toAdd, toRemove } = favoriteStatus;

    const snapshot = (queryClient.getQueryData(FAVORITES_QUERY_KEY) as FavoriteKey[] | undefined)
      ?? (Array.isArray(favorites) ? (favorites as FavoriteKey[]) : undefined)
      ?? (initialFavoriteKeys || []);
    const originalFavorites = [...snapshot];

    const current = (localFavorites ?? (Array.isArray(favorites) ? (favorites as FavoriteKey[]) : []) ?? []);

    try {
      await queryClient.cancelQueries({ queryKey: FAVORITES_QUERY_KEY });
    } catch {}

    const optimisticFavorites = [
      ...current.filter((id) => !toRemove.includes(id as FavoriteKey)),
      ...toAdd,
    ];

    queryClient.setQueryData(FAVORITES_QUERY_KEY, optimisticFavorites);
    setLocalFavorites(optimisticFavorites);

    if (toRemove.length > 0) {
      const removalSet = new Set(toRemove);
      // Update all favorites queries (with any search params) using partial key match
      queryClient.setQueriesData<{ pages: InfiniteQueryResponse<ColumnSchema[], LogsMeta>[], pageParams: unknown[] } | undefined>(
        { queryKey: ["favorites", "rows"], exact: false },
        (previous) => {
          if (!previous || !previous.pages || previous.pages.length === 0) {
            return previous;
          }

          // Filter rows from all pages but keep page structure intact to preserve pagination
          const filteredPages = previous.pages.map((page) => {
            const filteredData = page.data.filter(
              (row) => !removalSet.has(stableGpuKey(row))
            );
            return {
              ...page,
              data: filteredData,
              meta: {
                ...page.meta,
                totalRowCount: optimisticFavorites.length,
                filterRowCount: optimisticFavorites.length,
              },
              // Keep original cursors intact to preserve pagination
              // Only set nextCursor to null if this was the last page and we removed all remaining items
            };
          });

          // Only set nextCursor to null on the last page if all favorites are removed
          if (optimisticFavorites.length === 0) {
            const lastPage = filteredPages[filteredPages.length - 1];
            if (lastPage) {
              filteredPages[filteredPages.length - 1] = {
                ...lastPage,
                nextCursor: null,
              };
            }
          }

          return {
            ...previous,
            pages: filteredPages,
          };
        },
      );
    }

    try {
      await Promise.all([
        toAdd.length > 0 ? addFavorites(toAdd) : Promise.resolve(),
        toRemove.length > 0 ? removeFavorites(toRemove) : Promise.resolve(),
      ]);

      if (toAdd.length > 0) {
        try {
          const newRows = await fetchFavoriteRowsByKeys(toAdd as FavoriteKey[]);
          if (newRows.length) {
            // Update all favorites queries (with any search params) using partial key match
            queryClient.setQueriesData<{ pages: InfiniteQueryResponse<ColumnSchema[], LogsMeta>[], pageParams: unknown[] } | undefined>(
              { queryKey: ["favorites", "rows"], exact: false },
              (previous) => {
                if (!previous || !previous.pages || previous.pages.length === 0) {
                  // If no previous data, create first page with new rows
                  const firstPage: InfiniteQueryResponse<ColumnSchema[], LogsMeta> = {
                    data: newRows,
                    meta: {
                      totalRowCount: optimisticFavorites.length,
                      filterRowCount: optimisticFavorites.length,
                      facets: {},
                    },
                    prevCursor: null,
                    nextCursor: null,
                  };
                  return {
                    pages: [firstPage],
                    pageParams: [{ cursor: null, size: 50 }],
                  };
                }

                // Get existing rows from all pages
                const existingRows = previous.pages.flatMap((page) => page.data ?? []);
                const existingKeys = new Set(existingRows.map((row) => stableGpuKey(row)));
                
                // Filter out duplicates and merge
                const rowsToAdd = newRows.filter((row) => !existingKeys.has(stableGpuKey(row)));
                if (rowsToAdd.length === 0) return previous;

                // Add to last page if there's space, otherwise create new page
                const lastPage = previous.pages[previous.pages.length - 1];
                const pageSize = lastPage?.data?.length ?? 50;
                
                if (lastPage && lastPage.data.length + rowsToAdd.length <= pageSize) {
                  // Add to last page
                  const updatedPages = [...previous.pages];
                  updatedPages[updatedPages.length - 1] = {
                    ...lastPage,
                    data: [...lastPage.data, ...rowsToAdd],
                    meta: {
                      ...lastPage.meta,
                      totalRowCount: optimisticFavorites.length,
                      filterRowCount: optimisticFavorites.length,
                    },
                  };
                  return {
                    ...previous,
                    pages: updatedPages,
                  };
                } else {
                  // Create new page
                  const newPage: InfiniteQueryResponse<ColumnSchema[], LogsMeta> = {
                    data: rowsToAdd,
                    meta: {
                      totalRowCount: optimisticFavorites.length,
                      filterRowCount: optimisticFavorites.length,
                      facets: {},
                    },
                    prevCursor: lastPage?.nextCursor ?? null,
                    nextCursor: null,
                  };
                  return {
                    ...previous,
                    pages: [...previous.pages, newPage],
                    pageParams: [...(previous.pageParams ?? []), { cursor: lastPage?.nextCursor ?? null, size: 50 }],
                  };
                }
              },
            );
          }
        } catch (error) {
          console.warn("[gpu favorites] failed to append rows after mutation", {
            error: error instanceof Error ? error.message : String(error),
          });
          void queryClient.invalidateQueries({ queryKey: ["favorites", "rows"], exact: false });
        }
      }
      try {
        bcRef.current?.postMessage({
          type: "updated",
          favorites: optimisticFavorites,
          source: broadcastId,
        });
      } catch {}

      // Don't invalidate immediately after successful mutation - the optimistic update already shows correct state
      // Server-side cache invalidation happens in the API route, so next natural refetch will get fresh data
      // Immediate invalidation causes race condition where refetch gets stale cache before tag invalidation propagates

      if (isMountedRef.current) {
        setIsMutating(false);
      }

      setNoticeVariant("success");
      if (toAdd.length > 0) {
        showFavoritesNotice("Added to favorites");
      } else if (toRemove.length > 0) {
        showFavoritesNotice("Removed from favorites");
      }
    } catch (error) {
      logger.warn("[gpu favorites] mutation failed", {
        toAddCount: toAdd.length,
        toRemoveCount: toRemove.length,
        error: error instanceof Error ? error.message : String(error),
      });

      queryClient.setQueryData(FAVORITES_QUERY_KEY, originalFavorites);
      setLocalFavorites(originalFavorites);
      void queryClient.invalidateQueries({ queryKey: ["favorites", "rows"], exact: false });

      if (isMountedRef.current) {
        setIsMutating(false);
        setNoticeVariant("error");
        if (error instanceof FavoritesAPIError) {
          if (error.status === 401) {
            promptForAuth();
            return;
          }

          if (error.status === 429) {
            showFavoritesNotice("Rate limit exceeded. Try again later");
            return;
          }

          if (error.code === "TIMEOUT") {
            showFavoritesNotice("Server took too long. Please try again.");
            return;
          }

          showFavoritesNotice(error.message);
        } else {
          showFavoritesNotice("Failed to update favorites");
        }
      }
    }
  };

  if (!hasSelection) return null;

  const content = (
    <div
      className="fixed inset-x-0 flex items-center justify-center px-4"
      style={{ bottom: `calc(24px + env(safe-area-inset-bottom))` }}
      aria-live="polite"
      role="region"
      aria-label="Selection actions"
    >
      <FavoritesNotice message={favoritesNotice} open={isFavoritesOpen} variant={noticeVariant} />
      <div
        className={cn(
          "z-[var(--z-island)] flex w-auto items-center gap-2 rounded-xl border border-border bg-background/95 p-2 shadow-lg backdrop-blur transition-all duration-200 motion-reduce:transition-none",
          "supports-[backdrop-filter]:bg-background/60",
        )}
      >
        <Button
          size="sm"
          variant="secondary"
          className="gap-2"
          onClick={handleFavorite}
          aria-disabled={isMutating}
          aria-label="Toggle favorite status"
        >
          <Star
            className={`h-4 w-4 ${
              favoriteStatus.shouldRemove
                ? "fill-yellow-400 text-yellow-400"
                : ""
            }`}
          />
          <span>
            {favoriteStatus.shouldRemove
              ? "Favorited"
              : favoriteStatus.shouldAdd
              ? "Favorite"
              : "Favorite"}
          </span>
        </Button>
        {canCompare ? (
          <Button
            size="sm"
            variant="secondary"
            className="gap-2 disabled:opacity-100 disabled:text-muted-foreground"
            aria-label="Compare selected"
          >
            <GitCompare className="h-4 w-4" />
            <span>Compare</span>
          </Button>
        ) : (
          <HoverCard>
            <HoverCardTrigger asChild>
              <span tabIndex={0} className="inline-flex">
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-2 disabled:opacity-100 disabled:text-muted-foreground"
                  disabled
                  aria-label="Select at least 2 to compare"
                >
                  <GitCompare className="h-4 w-4" />
                  <span>Compare</span>
                </Button>
              </span>
            </HoverCardTrigger>
          <HoverCardContent side="top" align="center" sideOffset={16} className="z-[var(--z-tooltip)] text-xs w-auto whitespace-nowrap p-2">
            Select at least 2 to compare
          </HoverCardContent>
          </HoverCard>
        )}
        <Button size="sm" variant="secondary" className="gap-2 disabled:opacity-100 disabled:text-muted-foreground" aria-label="Deploy selected">
          <Rocket className="h-4 w-4" />
          <span>Deploy</span>
        </Button>
        
      </div>
    </div>
  );

  if (typeof document === "undefined") return content;
  return createPortal(content, document.body);
}

