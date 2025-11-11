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
import { FavoritesNotice } from "@/components/infinite-table/_components/favorites-notice";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ModelsColumnSchema } from "./models-schema";
import type { ModelFavoriteKey } from "@/types/model-favorites";
import { stableModelKey } from "./stable-key";
import type { ModelsInfiniteQueryResponse, ModelsLogsMeta } from "./models-query-options";
import {
  MODEL_FAVORITES_QUERY_KEY,
  MODEL_FAVORITES_BROADCAST_CHANNEL,
} from "@/lib/model-favorites/constants";
import {
  getModelFavorites,
  addModelFavorites,
  removeModelFavorites,
  ModelFavoritesAPIError,
} from "@/lib/model-favorites/api-client";
import { useAuthDialog } from "@/providers/auth-dialog-provider";
import { useAuth } from "@/providers/auth-client-provider";
import { getFavoritesBroadcastId } from "@/lib/model-favorites/broadcast";
import type { Row } from "@tanstack/react-table";
import { ModelCompareDialog } from "./model-compare-dialog";

export function ModelsCheckedActionsIsland({ initialFavoriteKeys }: { initialFavoriteKeys?: ModelFavoriteKey[] }) {
  const { checkedRows, table } = useDataTable<ModelsColumnSchema, unknown>();
  const queryClient = useQueryClient();
  const bcRef = React.useRef<BroadcastChannel | null>(null);
  const isMountedRef = React.useRef(true);
  const { message: favoritesNotice, isOpen: isFavoritesOpen, show: showFavoritesNotice } = useEphemeralNotice(1600);
  const [noticeVariant, setNoticeVariant] = React.useState<"success" | "error">("success");
  const { showSignIn } = useAuthDialog();
  const { session, isPending: authPending } = useAuth();
  const broadcastId = React.useMemo(() => getFavoritesBroadcastId(), []);
  const [isCompareOpen, setIsCompareOpen] = React.useState(false);

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
  const selectedRows = React.useMemo<Row<ModelsColumnSchema>[]>(() => {
    return table
      .getRowModel()
      .flatRows.filter((row) => checkedRows[row.id]) as Row<ModelsColumnSchema>[];
  }, [table, checkedRows]);
  const compareRows = React.useMemo(() => selectedRows.slice(0, 2), [selectedRows]);

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
      const existing = queryClient.getQueryData<ModelFavoriteKey[]>(MODEL_FAVORITES_QUERY_KEY);
      if (!existing) {
        queryClient.setQueryData(MODEL_FAVORITES_QUERY_KEY, initialFavoriteKeys);
      }
    }
  }, [initialFavoriteKeys, queryClient]);

  const prevFavoritesRef = React.useRef<string>("");
  
  // Initialize localFavorites from initialFavoriteKeys or React Query cache
  // Only seed if data already exists (from SSR or previous query)
  const [localFavorites, setLocalFavorites] = React.useState<ModelFavoriteKey[] | undefined>(() => {
    const cached = queryClient.getQueryData<ModelFavoriteKey[]>(MODEL_FAVORITES_QUERY_KEY);
    const initial = cached ?? initialFavoriteKeys;
    if (initial) {
      prevFavoritesRef.current = JSON.stringify(initial);
    }
    return initial;
  });

  const { data: favorites = [] } = useQuery({
    queryKey: MODEL_FAVORITES_QUERY_KEY,
    queryFn: getModelFavorites,
    staleTime: Infinity,
    enabled: hasSelection,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  React.useEffect(() => {
    if (Array.isArray(favorites)) {
      const favoritesArray = favorites as ModelFavoriteKey[];
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
      void queryClient.removeQueries({ queryKey: MODEL_FAVORITES_QUERY_KEY });
    }
  }, [authPending, queryClient, session]);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
      return;
    }
    const bc = new BroadcastChannel(MODEL_FAVORITES_BROADCAST_CHANNEL);
    bcRef.current = bc;
    const timeoutIds: NodeJS.Timeout[] = [];

    bc.onmessage = (event) => {
      if (event.data?.type === "updated" && Array.isArray(event.data?.favorites)) {
        if (event.data?.source === broadcastId) {
          return;
        }
        const newFavorites = event.data.favorites as ModelFavoriteKey[];
        queryClient.setQueryData(MODEL_FAVORITES_QUERY_KEY, newFavorites);
        setLocalFavorites(newFavorites);
        
        // Invalidate favorites rows query
        void queryClient.invalidateQueries({ 
          queryKey: ["model-favorites", "rows"], 
          exact: false 
        });
        
        // Delay refetch to allow server cache invalidation to propagate
        const timeoutId = setTimeout(() => {
          void queryClient.refetchQueries({
            queryKey: ["model-favorites", "rows"],
            exact: false,
            type: "active",
          });
        }, 100);
        timeoutIds.push(timeoutId);
      }
    };

    return () => {
      bc.close();
      bcRef.current = null;
      timeoutIds.forEach(clearTimeout);
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

  React.useEffect(() => {
    if (!canCompare && isCompareOpen) {
      setIsCompareOpen(false);
    }
  }, [canCompare, isCompareOpen]);

  const favoriteStatus = React.useMemo(() => {
    const selectedRowIds = Object.keys(checkedRows);
    const rowById = new Map(table.getRowModel().flatRows.map(r => [r.id, r.original as ModelsColumnSchema]));
    const selectedKeys = selectedRowIds
      .map(id => rowById.get(id))
      .filter(Boolean)
      .map(row => stableModelKey(row as ModelsColumnSchema));

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
  const MAX_FAVORITES_PER_REQUEST = 50;

  const fetchFavoriteRowsByKeys = React.useCallback(async (keys: ModelFavoriteKey[]) => {
    if (!keys.length) return [] as ModelsColumnSchema[];

    const uniqueKeys = Array.from(new Set(keys));
    const rowsByKey = new Map<string, ModelsColumnSchema>();

    for (let index = 0; index < uniqueKeys.length; index += FAVORITES_CHUNK_SIZE) {
      const chunk = uniqueKeys.slice(index, index + FAVORITES_CHUNK_SIZE);
      const response = await fetch("/api/models/favorites/rows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ keys: chunk }),
      });

      if (!response.ok) {
        throw new Error("Failed to load favorite rows");
      }

      const json = (await response.json()) as { rows: ModelsColumnSchema[] };
      for (const row of json.rows ?? []) {
        rowsByKey.set(row.id, row);
        rowsByKey.set(stableModelKey(row), row);
      }
    }

    return keys
      .map((key) => rowsByKey.get(key))
      .filter((row): row is ModelsColumnSchema => Boolean(row));
  }, []);

  const handleFavorite = async () => {
    if (!hasSelection) return;
    if (!session) {
      promptForAuth();
      return;
    }
    if (isMutating) return;

    const { toAdd, toRemove } = favoriteStatus;

    if (toAdd.length > MAX_FAVORITES_PER_REQUEST || toRemove.length > MAX_FAVORITES_PER_REQUEST) {
      setNoticeVariant("error");
      showFavoritesNotice(`Error: Max ${MAX_FAVORITES_PER_REQUEST} rows per request`);
      return;
    }
    setIsMutating(true);

    const snapshot = (queryClient.getQueryData(MODEL_FAVORITES_QUERY_KEY) as ModelFavoriteKey[] | undefined)
      ?? (Array.isArray(favorites) ? (favorites as ModelFavoriteKey[]) : undefined)
      ?? (initialFavoriteKeys || []);
    const originalFavorites = [...snapshot];

    const current = (localFavorites ?? (Array.isArray(favorites) ? (favorites as ModelFavoriteKey[]) : []) ?? []);
    const shouldForceInvalidate = current.length === 0 && toAdd.length > 0;
    const hasFavoritesRowsCache =
      queryClient.getQueriesData({ queryKey: ["model-favorites", "rows"], exact: false }).length > 0;

    try {
      await queryClient.cancelQueries({ queryKey: MODEL_FAVORITES_QUERY_KEY });
    } catch {}

    const optimisticFavorites = [
      ...current.filter((id) => !toRemove.includes(id as ModelFavoriteKey)),
      ...toAdd,
    ];

    queryClient.setQueryData(MODEL_FAVORITES_QUERY_KEY, optimisticFavorites);
    setLocalFavorites(optimisticFavorites);

    if (hasFavoritesRowsCache && toRemove.length > 0) {
      const removalSet = new Set(toRemove);
      // Update all favorites queries (with any search params) using partial key match
      queryClient.setQueriesData<{ pages: ModelsInfiniteQueryResponse<ModelsColumnSchema[], ModelsLogsMeta>[], pageParams: unknown[] } | undefined>(
        { queryKey: ["model-favorites", "rows"], exact: false },
        (previous) => {
          if (!previous || !previous.pages || previous.pages.length === 0) {
            return previous;
          }

          // Filter rows from all pages but keep page structure intact to preserve pagination
          const filteredPages = previous.pages.map((page) => {
            const filteredData = page.data.filter(
              (row) => !removalSet.has(stableModelKey(row))
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
        toAdd.length > 0 ? addModelFavorites(toAdd) : Promise.resolve(),
        toRemove.length > 0 ? removeModelFavorites(toRemove) : Promise.resolve(),
      ]);

      if (hasFavoritesRowsCache && toAdd.length > 0) {
        try {
          const newRows = await fetchFavoriteRowsByKeys(toAdd as ModelFavoriteKey[]);
          if (newRows.length) {
            // Update all favorites queries (with any search params) using partial key match
            queryClient.setQueriesData<{ pages: ModelsInfiniteQueryResponse<ModelsColumnSchema[], ModelsLogsMeta>[], pageParams: unknown[] } | undefined>(
              { queryKey: ["model-favorites", "rows"], exact: false },
              (previous) => {
          if (!previous || !previous.pages || previous.pages.length === 0) {
            return previous;
          }

                // Get existing rows from all pages
                const existingRows = previous.pages.flatMap((page) => page.data ?? []);
                const existingKeys = new Set(existingRows.map((row) => stableModelKey(row)));
                
                // Filter out duplicates and merge
                const rowsToAdd = newRows.filter((row) => !existingKeys.has(stableModelKey(row)));
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
                  const newPage: ModelsInfiniteQueryResponse<ModelsColumnSchema[], ModelsLogsMeta> = {
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
          console.warn("[models favorites] failed to append rows after mutation", {
            error: error instanceof Error ? error.message : String(error),
          });
          void queryClient.invalidateQueries({ queryKey: ["model-favorites", "rows"], exact: false });
        }
      }
      if (shouldForceInvalidate) {
        void queryClient.invalidateQueries({ queryKey: ["model-favorites", "rows"], exact: false });
      }
      // Broadcast to other tabs (they will handle delayed refetch)
      try {
        bcRef.current?.postMessage({
          type: "updated",
          favorites: optimisticFavorites,
          source: broadcastId,
        });
      } catch {}

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
      logger.warn("[models favorites] mutation failed", {
        toAddCount: toAdd.length,
        toRemoveCount: toRemove.length,
        error: error instanceof Error ? error.message : String(error),
      });

      queryClient.setQueryData(MODEL_FAVORITES_QUERY_KEY, originalFavorites);
      setLocalFavorites(originalFavorites);
      void queryClient.invalidateQueries({ queryKey: ["model-favorites", "rows"], exact: false });

      if (isMountedRef.current) {
        setIsMutating(false);
        setNoticeVariant("error");
        if (error instanceof ModelFavoritesAPIError) {
          if (error.status === 401) {
            promptForAuth();
            return;
          }

          if (error.status === 429) {
            showFavoritesNotice("Rate limit exceeded. Try again later");
            return;
          }

          if (error.status === 400) {
            showFavoritesNotice(`Error: Max ${MAX_FAVORITES_PER_REQUEST} rows per request`);
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
      className="pointer-events-none fixed inset-x-0 flex items-center justify-center px-4"
      style={{ bottom: `calc(24px + env(safe-area-inset-bottom))` }}
      aria-live="polite"
      role="region"
      aria-label="Selection actions"
    >
      <FavoritesNotice message={favoritesNotice} open={isFavoritesOpen} variant={noticeVariant} />
      <div
        className={cn(
          "pointer-events-auto z-[var(--z-island)] flex w-auto items-center gap-2 rounded-xl border border-border bg-background/95 p-2 shadow-lg backdrop-blur transition-all duration-200 motion-reduce:transition-none",
          "supports-[backdrop-filter]:bg-background/60",
        )}
      >
        <Button
          size="sm"
          variant="secondary"
          className="gap-2"
          onClick={handleFavorite}
          disabled={isMutating}
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
            onClick={() => setIsCompareOpen(true)}
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

  const island = typeof document === "undefined" ? content : createPortal(content, document.body);

  return (
    <>
      <ModelCompareDialog
        open={isCompareOpen}
        onOpenChange={setIsCompareOpen}
        rows={compareRows}
        table={table}
      />
      {island}
    </>
  );
}
