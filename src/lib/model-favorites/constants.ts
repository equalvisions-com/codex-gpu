export const MODEL_FAVORITES_QUERY_KEY = ["model-favorites"] as const;
export const MODEL_FAVORITES_BROADCAST_CHANNEL = "model-favorites" as const;
export const MODEL_FAVORITES_CACHE_TTL = 43200;
export const MODEL_FAVORITES_API_TIMEOUT = 10000;

export function getModelFavoritesCacheTag(userId: string): string {
  return `model-favorites:user:${userId}`;
}

export function getModelFavoritesRateLimitKey(userId: string): string {
  return `model-favorites:${userId}`;
}
