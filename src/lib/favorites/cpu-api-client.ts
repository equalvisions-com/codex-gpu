import type { FavoritesResponse, FavoritesRequest, FavoriteKey } from "@/types/favorites";
import { FAVORITES_API_TIMEOUT } from "./constants";

/**
 * Custom error class for CPU favorites API operations
 * Provides structured error information for better error handling
 */
export class CpuFavoritesAPIError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "CpuFavoritesAPIError";
  }
}

/**
 * Creates a fetch request with automatic timeout
 * Prevents hanging requests from blocking the UI indefinitely
 *
 * @param url - The API endpoint URL
 * @param options - Standard fetch options
 * @param timeout - Timeout in milliseconds (default: 10s)
 * @returns Promise that resolves with Response or rejects on timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = FAVORITES_API_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new CpuFavoritesAPIError(
        "Request timeout - server took too long to respond",
        408,
        "TIMEOUT"
      );
    }
    throw error;
  }
}

/**
 * Fetches the current user's CPU favorites from the API
 *
 * @returns Promise resolving to array of CPU favorite keys
 * @throws CpuFavoritesAPIError on failure
 *
 * @example
 * ```typescript
 * try {
 *   const favorites = await getCpuFavorites();
 * } catch (error) {
 *   if (error instanceof CpuFavoritesAPIError && error.status === 401) {
 *     // Redirect to login
 *   }
 * }
 * ```
 */
export async function getCpuFavorites(): Promise<FavoriteKey[]> {
  try {
    const response = await fetchWithTimeout("/api/cpu/favorites");

    if (response.status === 401) {
      throw new CpuFavoritesAPIError("Unauthorized", 401, "UNAUTHORIZED");
    }

    if (response.status === 429) {
      throw new CpuFavoritesAPIError(
        "Rate limit exceeded, try again shortly",
        429,
        "RATE_LIMIT"
      );
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new CpuFavoritesAPIError(
        errorData?.error || "Failed to fetch CPU favorites",
        response.status,
        "API_ERROR"
      );
    }

    const data: FavoritesResponse = await response.json();
    return (data.favorites || []) as FavoriteKey[];
  } catch (error) {
    if (error instanceof CpuFavoritesAPIError) {
      throw error;
    }

    console.error('[getCpuFavorites] Unexpected error', {
      error: error instanceof Error ? error.message : String(error),
    });

    throw new CpuFavoritesAPIError(
      "Network error - failed to fetch CPU favorites",
      0,
      "NETWORK_ERROR"
    );
  }
}

/**
 * Adds one or more CPUs to user's favorites
 *
 * @param cpuUuids - Array of CPU UUIDs to favorite
 * @returns Promise resolving on success
 * @throws CpuFavoritesAPIError on failure
 */
export async function addCpuFavorites(cpuUuids: FavoriteKey[]): Promise<void> {
  if (cpuUuids.length === 0) return;

  try {
    const response = await fetchWithTimeout("/api/cpu/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cpuUuids } satisfies FavoritesRequest),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new CpuFavoritesAPIError(
        errorData?.error || "Failed to add CPU favorites",
        response.status,
        response.status === 429 ? "RATE_LIMIT" : "API_ERROR"
      );
    }
  } catch (error) {
    if (error instanceof CpuFavoritesAPIError) {
      throw error;
    }

    console.error('[addCpuFavorites] Unexpected error', {
      count: cpuUuids.length,
      error: error instanceof Error ? error.message : String(error),
    });

    throw new CpuFavoritesAPIError(
      "Network error - failed to add CPU favorites",
      0,
      "NETWORK_ERROR"
    );
  }
}

/**
 * Removes one or more CPUs from user's favorites
 *
 * @param cpuUuids - Array of CPU UUIDs to unfavorite
 * @returns Promise resolving on success
 * @throws CpuFavoritesAPIError on failure
 */
export async function removeCpuFavorites(cpuUuids: FavoriteKey[]): Promise<void> {
  if (cpuUuids.length === 0) return;

  try {
    const response = await fetchWithTimeout("/api/cpu/favorites", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cpuUuids } satisfies FavoritesRequest),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new CpuFavoritesAPIError(
        errorData?.error || "Failed to remove CPU favorites",
        response.status,
        response.status === 429 ? "RATE_LIMIT" : "API_ERROR"
      );
    }
  } catch (error) {
    if (error instanceof CpuFavoritesAPIError) {
      throw error;
    }

    console.error('[removeCpuFavorites] Unexpected error', {
      count: cpuUuids.length,
      error: error instanceof Error ? error.message : String(error),
    });

    throw new CpuFavoritesAPIError(
      "Network error - failed to remove CPU favorites",
      0,
      "NETWORK_ERROR"
    );
  }
}
