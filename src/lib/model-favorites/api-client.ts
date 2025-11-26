import type { ModelFavoriteKey, ModelFavoritesRequest, ModelFavoritesResponse } from "@/types/model-favorites";
import type { ModelsColumnSchema } from "@/features/data-explorer/models/models-schema";
import type { ModelsInfiniteQueryResponse, ModelsLogsMeta } from "@/features/data-explorer/models/models-query-options";
import { modelsSearchParamsSerializer } from "@/features/data-explorer/models/models-search-params";
import { MODEL_FAVORITES_API_TIMEOUT } from "./constants";

export class ModelFavoritesAPIError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "ModelFavoritesAPIError";
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = MODEL_FAVORITES_API_TIMEOUT
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
      throw new ModelFavoritesAPIError(
        "Request timeout - server took too long to respond",
        408,
        "TIMEOUT"
      );
    }
    throw error;
  }
}

export async function getModelFavorites(): Promise<ModelFavoriteKey[]> {
  try {
    const response = await fetchWithTimeout("/api/models/favorites");

    if (response.status === 401) {
      throw new ModelFavoritesAPIError("Unauthorized", 401, "UNAUTHORIZED");
    }

    if (response.status === 429) {
      throw new ModelFavoritesAPIError(
        "Rate limit exceeded, try again shortly",
        429,
        "RATE_LIMIT"
      );
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new ModelFavoritesAPIError(
        errorData?.error || "Failed to fetch favorites",
        response.status,
        "API_ERROR"
      );
    }

    const data: ModelFavoritesResponse = await response.json();
    return (data.favorites || []) as ModelFavoriteKey[];
  } catch (error) {
    if (error instanceof ModelFavoritesAPIError) {
      throw error;
    }

    console.error("[getModelFavorites] Unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });

    throw new ModelFavoritesAPIError(
      "Network error - failed to fetch favorites",
      0,
      "NETWORK_ERROR"
    );
  }
}

export async function getModelFavoriteRows(
  serializedSearch: string | { [key: string]: unknown }
): Promise<ModelsInfiniteQueryResponse<ModelsColumnSchema[], ModelsLogsMeta>> {
  try {
    const query =
      typeof serializedSearch === "string"
        ? serializedSearch
        : modelsSearchParamsSerializer(serializedSearch);

    const url = query.startsWith("?")
      ? `/api/models/favorites/rows${query}`
      : `/api/models/favorites/rows?${query}`;

    const response = await fetchWithTimeout(url);

    if (response.status === 401) {
      throw new ModelFavoritesAPIError("Unauthorized", 401, "UNAUTHORIZED");
    }

    if (response.status === 429) {
      throw new ModelFavoritesAPIError(
        "Rate limit exceeded, try again shortly",
        429,
        "RATE_LIMIT"
      );
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new ModelFavoritesAPIError(
        errorData?.error || "Failed to fetch favorite rows",
        response.status,
        "API_ERROR"
      );
    }

    const data: ModelsInfiniteQueryResponse<ModelsColumnSchema[], ModelsLogsMeta> = await response.json();
    return data;
  } catch (error) {
    if (error instanceof ModelFavoritesAPIError) {
      throw error;
    }

    console.error("[getModelFavoriteRows] Unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });

    throw new ModelFavoritesAPIError(
      "Network error - failed to fetch favorite rows",
      0,
      "NETWORK_ERROR"
    );
  }
}

export async function addModelFavorites(modelIds: ModelFavoriteKey[]): Promise<void> {
  if (modelIds.length === 0) return;

  try {
    const response = await fetchWithTimeout("/api/models/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelIds } satisfies ModelFavoritesRequest),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new ModelFavoritesAPIError(
        errorData?.error || "Failed to add favorites",
        response.status,
        response.status === 429 ? "RATE_LIMIT" : "API_ERROR"
      );
    }
  } catch (error) {
    if (error instanceof ModelFavoritesAPIError) {
      throw error;
    }

    console.error("[addModelFavorites] Unexpected error", {
      count: modelIds.length,
      error: error instanceof Error ? error.message : String(error),
    });

    throw new ModelFavoritesAPIError(
      "Network error - failed to add favorites",
      0,
      "NETWORK_ERROR"
    );
  }
}

export async function removeModelFavorites(modelIds: ModelFavoriteKey[]): Promise<void> {
  if (modelIds.length === 0) return;

  try {
    const response = await fetchWithTimeout("/api/models/favorites", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelIds } satisfies ModelFavoritesRequest),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new ModelFavoritesAPIError(
        errorData?.error || "Failed to remove favorites",
        response.status,
        response.status === 429 ? "RATE_LIMIT" : "API_ERROR"
      );
    }
  } catch (error) {
    if (error instanceof ModelFavoritesAPIError) {
      throw error;
    }

    console.error("[removeModelFavorites] Unexpected error", {
      count: modelIds.length,
      error: error instanceof Error ? error.message : String(error),
    });

    throw new ModelFavoritesAPIError(
      "Network error - failed to remove favorites",
      0,
      "NETWORK_ERROR"
    );
  }
}
