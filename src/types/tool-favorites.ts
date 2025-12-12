export type ToolFavoriteKey = string;

export interface ToolFavoritesResponse {
  favorites: ToolFavoriteKey[];
}

export interface ToolFavoritesRequest {
  toolIds?: ToolFavoriteKey[];
}
