import { unstable_cache } from "next/cache";
import { db } from "@/db/client";
import { userModelFavorites } from "@/db/schema";
import { eq } from "drizzle-orm";
import { MODEL_FAVORITES_CACHE_TTL, getModelFavoritesCacheTag } from "./constants";
import type { ModelFavoriteKey } from "@/types/model-favorites";

type UserModelFavoriteRow = {
  id: string;
  userId: string;
  modelId: string;
  createdAt: Date | null;
};

export async function getUserModelFavoritesFromCache(userId: string): Promise<ModelFavoriteKey[]> {
  const getCached = unstable_cache(
    async (uid: string) => {
      try {
        const rows = await db
          .select()
          // @ts-ignore - Drizzle ORM type conflict
          .from(userModelFavorites)
          // @ts-ignore - Drizzle ORM type conflict
          .where(eq(userModelFavorites.userId, uid));

        const typedRows = rows as unknown as UserModelFavoriteRow[];
        return (typedRows || []).map((r) => r.modelId as ModelFavoriteKey);
      } catch (error) {
        console.error("[getUserModelFavoritesFromCache] Database query failed", {
          userId: uid,
          error: error instanceof Error ? error.message : String(error),
        });
        return [];
      }
    },
    ["model-favorites:keys"],
    {
      revalidate: MODEL_FAVORITES_CACHE_TTL,
      tags: [getModelFavoritesCacheTag(userId)],
    }
  );

  return getCached(userId);
}
