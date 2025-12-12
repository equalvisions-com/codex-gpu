import type {
  ToolFavoriteKey,
  ToolFavoritesRequest,
  ToolFavoritesResponse,
} from "@/types/tool-favorites";
import type { ToolInfiniteQueryResponse, ToolLogsMeta } from "@/features/data-explorer/tools/tools-query-options";
import type { ToolColumnSchema } from "@/features/data-explorer/tools/tools-schema";
import { toolsSearchParamsSerializer } from "@/features/data-explorer/tools/tools-search-params";
import { TOOL_FAVORITES_API_TIMEOUT } from "./constants";

export class ToolFavoritesAPIError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ToolFavoritesAPIError";
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = TOOL_FAVORITES_API_TIMEOUT,
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
      throw new ToolFavoritesAPIError("Request timeout - server took too long to respond", 408, "TIMEOUT");
    }
    throw error;
  }
}

export async function getToolFavorites(): Promise<ToolFavoriteKey[]> {
  try {
    const response = await fetchWithTimeout("/api/tools/favorites");

    if (response.status === 401) {
      throw new ToolFavoritesAPIError("Unauthorized", 401, "UNAUTHORIZED");
    }
    if (response.status === 429) {
      throw new ToolFavoritesAPIError("Rate limit exceeded, try again shortly", 429, "RATE_LIMIT");
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new ToolFavoritesAPIError(
        errorData?.error || "Failed to fetch favorites",
        response.status,
        "API_ERROR",
      );
    }

    const data: ToolFavoritesResponse = await response.json();
    return (data.favorites || []) as ToolFavoriteKey[];
  } catch (error) {
    if (error instanceof ToolFavoritesAPIError) {
      throw error;
    }
    console.error("[getToolFavorites] Unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new ToolFavoritesAPIError("Network error - failed to fetch favorites", 0, "NETWORK_ERROR");
  }
}

export async function getToolFavoriteRows(
  serializedSearch: string | Record<string, unknown>,
): Promise<ToolInfiniteQueryResponse<ToolColumnSchema[], ToolLogsMeta>> {
  try {
    const query =
      typeof serializedSearch === "string"
        ? serializedSearch
        : toolsSearchParamsSerializer(serializedSearch);

    const url = query.startsWith("?")
      ? `/api/tools/favorites/rows${query}`
      : `/api/tools/favorites/rows?${query}`;

    const response = await fetchWithTimeout(url);

    if (response.status === 401) {
      throw new ToolFavoritesAPIError("Unauthorized", 401, "UNAUTHORIZED");
    }
    if (response.status === 429) {
      throw new ToolFavoritesAPIError("Rate limit exceeded, try again shortly", 429, "RATE_LIMIT");
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new ToolFavoritesAPIError(
        errorData?.error || "Failed to fetch favorite rows",
        response.status,
        "API_ERROR",
      );
    }

    const data: ToolInfiniteQueryResponse<ToolColumnSchema[], ToolLogsMeta> = await response.json();
    return data;
  } catch (error) {
    if (error instanceof ToolFavoritesAPIError) {
      throw error;
    }
    console.error("[getToolFavoriteRows] Unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new ToolFavoritesAPIError("Network error - failed to fetch favorite rows", 0, "NETWORK_ERROR");
  }
}

export async function addToolFavorites(toolIds: ToolFavoriteKey[]): Promise<void> {
  if (!toolIds.length) return;

  try {
    const response = await fetchWithTimeout("/api/tools/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolIds } satisfies ToolFavoritesRequest),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new ToolFavoritesAPIError(
        errorData?.error || "Failed to add favorites",
        response.status,
        response.status === 429 ? "RATE_LIMIT" : "API_ERROR",
      );
    }
  } catch (error) {
    if (error instanceof ToolFavoritesAPIError) {
      throw error;
    }
    console.error("[addToolFavorites] Unexpected error", {
      count: toolIds.length,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new ToolFavoritesAPIError("Network error - failed to add favorites", 0, "NETWORK_ERROR");
  }
}

export async function removeToolFavorites(toolIds: ToolFavoriteKey[]): Promise<void> {
  if (!toolIds.length) return;

  try {
    const response = await fetchWithTimeout("/api/tools/favorites", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolIds } satisfies ToolFavoritesRequest),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new ToolFavoritesAPIError(
        errorData?.error || "Failed to remove favorites",
        response.status,
        response.status === 429 ? "RATE_LIMIT" : "API_ERROR",
      );
    }
  } catch (error) {
    if (error instanceof ToolFavoritesAPIError) {
      throw error;
    }
    console.error("[removeToolFavorites] Unexpected error", {
      count: toolIds.length,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new ToolFavoritesAPIError("Network error - failed to remove favorites", 0, "NETWORK_ERROR");
  }
}
