import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { userCpuFavorites } from "@/db/cpu-schema";
import { eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { getFavoritesCacheTag } from "./constants";

/**
 * Database row type for user_cpu_favorites table
 */
type UserCpuFavoriteRow = {
  id: string;
  userId: string;
  cpuUuid: string;
  createdAt: Date | null;
};

/**
 * Fetches CPU favorites from database with caching
 * Used for server-side rendering of favorites data
 *
 * @param userId - User ID to fetch favorites for
 * @returns Promise resolving to array of CPU UUID strings
 */
export async function getUserCpuFavoritesFromCache(userId: string): Promise<string[]> {
  return await unstable_cache(
    async () => {
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
          .from(userCpuFavorites)
          // @ts-ignore - Drizzle ORM type conflict between build artifacts
          .where(eq(userCpuFavorites.userId, userId));

        const typedRows = rows as unknown as UserCpuFavoriteRow[];
        return (typedRows || []).map((r) => r.cpuUuid);
      } catch (error) {
        console.error("[getUserCpuFavoritesFromCache] Database query failed", {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        return [];
      }
    },
    [`user-cpu-favorites:${userId}`],
    {
      revalidate: 300, // 5 minutes
      tags: [getFavoritesCacheTag(userId)],
    }
  )();
}
