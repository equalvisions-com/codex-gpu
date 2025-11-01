import { unstable_cache } from "next/cache";
import { db } from "@/db/client";
import { userFavorites } from "@/db/schema";
import { eq } from "drizzle-orm";
import { FAVORITES_CACHE_TTL, getFavoritesCacheTag } from "./constants";
import type { FavoriteKey } from "@/types/favorites";

/**
 * Database row type for user_favorites table
 * Defines the shape of data returned from Drizzle queries
 */
type UserFavoriteRow = {
  id: string;
  userId: string;
  gpuUuid: string;
  createdAt: Date | null;
};

const CACHE_SIZE_LIMIT_BYTES = 2 * 1024 * 1024; // 2MB

export class CacheSizeLimitError extends Error {
  constructor(message: string, public readonly size: number) {
    super(message);
    this.name = "CacheSizeLimitError";
  }
}

/**
 * Fetches a user's favorite GPU UUIDs with Next.js caching
 * 
 * This function is cached using Next.js's unstable_cache with:
 * - 12 hour revalidation period
 * - User-specific cache tags for targeted invalidation
 * - Distributed cache across serverless functions
 * - Explicit 2MB size limit check before caching
 * 
 * @param userId - The user's ID from the session
 * @returns Array of GPU UUIDs that the user has favorited
 * @throws {CacheSizeLimitError} If the favorites list exceeds 2MB cache limit
 * 
 * @example
 * ```typescript
 * const favoriteKeys = await getUserFavoritesFromCache(session.user.id);
 * // ['gpu-uuid-1', 'gpu-uuid-2']
 * ```
 */
export async function getUserFavoritesFromCache(userId: string): Promise<FavoriteKey[]> {
  const getCached = unstable_cache(
    async (uid: string) => {
      try {
        /**
         * Type suppression needed due to Drizzle ORM build artifact conflicts
         * Issue: Multiple Drizzle versions in node_modules create incompatible type declarations
         * Solution: Use type assertion after query execution - runtime behavior is correct
         * TODO: Remove when Drizzle resolves upstream type conflicts
         */
        const rows = await db
          .select()
          // @ts-ignore - Drizzle ORM type conflict between build artifacts (see comment above)
          .from(userFavorites)
          // @ts-ignore - Drizzle ORM type conflict between build artifacts
          .where(eq(userFavorites.userId, uid));
        
        const typedRows = rows as unknown as UserFavoriteRow[];
        const keys = (typedRows || []).map((r) => r.gpuUuid as FavoriteKey);

        // Check estimated size before caching
        // Using JSON.stringify as a conservative estimate of serialized size
        const estimatedSize = JSON.stringify(keys).length;
        
        if (estimatedSize > CACHE_SIZE_LIMIT_BYTES) {
          console.warn("[getUserFavoritesFromCache] Cache size limit exceeded, skipping cache", {
            userId: uid,
            estimatedSizeBytes: estimatedSize,
            limitBytes: CACHE_SIZE_LIMIT_BYTES,
            favoriteCount: keys.length,
          });
          
          // Throw error to trigger fallback to direct DB query
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
        
        console.error('[getUserFavoritesFromCache] Database query failed', {
          userId: uid,
          error: error instanceof Error ? error.message : String(error),
        });
        return [];
      }
    },
    ["favorites:keys"],
    { 
      revalidate: FAVORITES_CACHE_TTL, 
      tags: [getFavoritesCacheTag(userId)] 
    }
  );

  try {
    return await getCached(userId);
  } catch (error) {
    // Re-throw cache size errors to trigger fallback in caller
    if (error instanceof CacheSizeLimitError) {
      throw error;
    }
    // Re-throw other errors as well
    throw error;
  }
}

/**
 * Direct database query for user favorites (bypasses cache)
 * Used as fallback when cache is unavailable or exceeds size limit
 * 
 * @param userId - The user's ID from the session
 * @returns Array of GPU UUIDs that the user has favorited
 */
export async function getUserFavoritesDirect(userId: string): Promise<FavoriteKey[]> {
  const rows = await db
    .select()
    // @ts-ignore - Drizzle ORM type conflict between build artifacts
    .from(userFavorites)
    // @ts-ignore - Drizzle ORM type conflict between build artifacts
    .where(eq(userFavorites.userId, userId));
  
  const typedRows = rows as unknown as UserFavoriteRow[];
  return (typedRows || []).map((r) => r.gpuUuid as FavoriteKey);
}

