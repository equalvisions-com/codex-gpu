import { unstable_cache } from "next/cache";
import { db } from "@/db/client";
import { userModelFavorites } from "@/db/schema";
import { eq, type InferSelectModel } from "drizzle-orm";
import { MODEL_FAVORITES_CACHE_TTL, getModelFavoritesCacheTag } from "./constants";
import type { ModelFavoriteKey } from "@/types/model-favorites";

type UserModelFavoriteRow = InferSelectModel<typeof userModelFavorites>;

const CACHE_SIZE_LIMIT_BYTES = 2 * 1024 * 1024; // 2MB

export class CacheSizeLimitError extends Error {
  constructor(message: string, public readonly size: number) {
    super(message);
    this.name = "CacheSizeLimitError";
  }
}

export async function getUserModelFavoritesFromCache(userId: string): Promise<ModelFavoriteKey[]> {
  const getCached = unstable_cache(
    async (uid: string) => {
      try {
        const rows = await db
          .select()
          .from(userModelFavorites)
          .where(eq(userModelFavorites.userId, uid));

        const keys = (rows as UserModelFavoriteRow[]).map((r) => r.modelId as ModelFavoriteKey);

        // Check estimated size before caching
        // Using JSON.stringify as a conservative estimate of serialized size
        const estimatedSize = JSON.stringify(keys).length;
        
        if (estimatedSize > CACHE_SIZE_LIMIT_BYTES) {
          console.warn("[getUserModelFavoritesFromCache] Cache size limit exceeded, skipping cache", {
            userId: uid,
            estimatedSizeBytes: estimatedSize,
            limitBytes: CACHE_SIZE_LIMIT_BYTES,
            favoriteCount: keys.length,
          });
          
          // Throw error to trigger lazy load
          throw new CacheSizeLimitError(
            `Cache size (${estimatedSize} bytes) exceeds limit (${CACHE_SIZE_LIMIT_BYTES} bytes)`,
            estimatedSize
          );
        }

        return keys;
      } catch (error) {
        // Re-throw cache size errors to let caller handle fallback
        if (error instanceof CacheSizeLimitError) {
          throw error;
        }
        
        console.error("[getUserModelFavoritesFromCache] Database query failed", {
          userId: uid,
          error: error instanceof Error ? error.message : String(error),
        });
        return [];
      }
    },
    ["model-favorites:keys", userId],
    {
      revalidate: MODEL_FAVORITES_CACHE_TTL,
      tags: [getModelFavoritesCacheTag(userId)],
    }
  );

  try {
    return await getCached(userId);
  } catch (error) {
    // Re-throw cache size errors to trigger lazy load in caller
    if (error instanceof CacheSizeLimitError) {
      throw error;
    }
    // Re-throw other errors as well
    throw error;
  }
}

export async function getUserModelFavoritesDirect(userId: string): Promise<ModelFavoriteKey[]> {
  const rows = await db
    .select()
    .from(userModelFavorites)
    .where(eq(userModelFavorites.userId, userId));

  return (rows as UserModelFavoriteRow[]).map((r) => r.modelId as ModelFavoriteKey);
}
