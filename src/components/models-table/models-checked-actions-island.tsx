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

export function ModelsCheckedActionsIsland({ initialFavoriteKeys }: { initialFavoriteKeys?: ModelFavoriteKey[] }) {
  const { checkedRows, table } = useDataTable<ModelsColumnSchema, unknown>();
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

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const hasSelection = React.useMemo(() => {
    for (const _ in checkedRows) return true;
    return false;
  }, [checkedRows]);

  const { data: favorites = [] } = useQuery({
    queryKey: MODEL_FAVORITES_QUERY_KEY,
    queryFn: getModelFavorites,
    staleTime: Infinity,
    enabled: !initialFavoriteKeys && hasSelection,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  React.useEffect(() => {
    const existing = queryClient.getQueryData<ModelFavoriteKey[]>(MODEL_FAVORITES_QUERY_KEY);
    if (!existing && initialFavoriteKeys) {
      queryClient.setQueryData(MODEL_FAVORITES_QUERY_KEY, initialFavoriteKeys);
    }
  }, [initialFavoriteKeys, queryClient]);

  const [localFavorites, setLocalFavorites] = React.useState<ModelFavoriteKey[] | undefined>(initialFavoriteKeys);
  const prevFavoritesRef = React.useRef<string>("");
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
    const bc = new BroadcastChannel(MODEL_FAVORITES_BROADCAST_CHANNEL);
    bcRef.current = bc;

    bc.onmessage = (event) => {
      if (event.data?.type === "updated" && Array.isArray(event.data?.favorites)) {
        const newFavorites = event.data.favorites as ModelFavoriteKey[];
        queryClient.setQueryData(MODEL_FAVORITES_QUERY_KEY, newFavorites);
        setLocalFavorites(newFavorites);
      }
    };

    return () => {
      bc.close();
      bcRef.current = null;
    };
  }, [queryClient]);

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

  const handleFavorite = async () => {
    if (!hasSelection) return;
    if (!session) {
      promptForAuth();
      return;
    }
    if (isMutating) return;
    setIsMutating(true);

    const { toAdd, toRemove } = favoriteStatus;

    const snapshot = (queryClient.getQueryData(MODEL_FAVORITES_QUERY_KEY) as ModelFavoriteKey[] | undefined)
      ?? (Array.isArray(favorites) ? (favorites as ModelFavoriteKey[]) : undefined)
      ?? (initialFavoriteKeys || []);
    const originalFavorites = [...snapshot];

    const current = (localFavorites ?? (Array.isArray(favorites) ? (favorites as ModelFavoriteKey[]) : []) ?? []);

    try {
      await queryClient.cancelQueries({ queryKey: MODEL_FAVORITES_QUERY_KEY });
    } catch {}

    const optimisticFavorites = [
      ...current.filter((id) => !toRemove.includes(id as ModelFavoriteKey)),
      ...toAdd,
    ];

    queryClient.setQueryData(MODEL_FAVORITES_QUERY_KEY, optimisticFavorites);
    setLocalFavorites(optimisticFavorites);

    try {
      await Promise.all([
        toAdd.length > 0 ? addModelFavorites(toAdd) : Promise.resolve(),
        toRemove.length > 0 ? removeModelFavorites(toRemove) : Promise.resolve(),
      ]);

      try {
        bcRef.current?.postMessage({ type: "updated", favorites: optimisticFavorites });
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
