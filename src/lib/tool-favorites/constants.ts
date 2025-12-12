export const TOOL_FAVORITES_QUERY_KEY = ["tool-favorites"] as const;
export const TOOL_FAVORITES_BROADCAST_CHANNEL = "tool-favorites" as const;
export const TOOL_FAVORITES_CACHE_TTL = 43200;
export const TOOL_FAVORITES_API_TIMEOUT = 10000;

export function getToolFavoritesCacheTag(userId: string): string {
  return `tool-favorites:user:${userId}`;
}

export function getToolFavoritesRateLimitKey(userId: string): string {
  return `tool-favorites:${userId}`;
}
