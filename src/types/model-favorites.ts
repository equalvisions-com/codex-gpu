export type ModelFavoriteKey = string;

export interface ModelFavoritesResponse {
  favorites: ModelFavoriteKey[];
}

export interface ModelFavoritesRequest {
  modelIds?: ModelFavoriteKey[];
}
