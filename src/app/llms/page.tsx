import * as React from "react";
import { modelsSearchParamsCache } from "@/components/models-table/models-search-params";
import { getQueryClient } from "@/providers/get-query-client";
import { modelsDataOptions } from "@/components/models-table/models-query-options";
import { ModelsClient } from "@/components/models-table/models-client";
export const revalidate = 60 * 60 * 24;

export default async function Models({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const isFavoritesMode = params.favorites === "true";
  const search = modelsSearchParamsCache.parse(params);
  const queryClient = getQueryClient();
  await queryClient.prefetchInfiniteQuery(modelsDataOptions(search));

  // Skip server-side cache check to avoid blocking SSR
  // Cache check happens client-side via prefetch (non-blocking HTTP request)
  // API endpoint uses unstable_cache server-side, so cache still benefits users
  // This ensures fast, non-blocking page render for all users
  // initialFavoriteKeys is always undefined from server, forcing client-side lazy loading or prefetching
  const initialFavoriteKeys: string[] | undefined = undefined;

  return (
    <div
      className="flex min-h-dvh w-full flex-col sm:flex-row pt-2 sm:p-0 min-h-0"
      style={{
        '--total-padding-mobile': 'calc(0.5rem + 0.5rem)',
        '--total-padding-desktop': '3rem',
      } as React.CSSProperties}
    >
      <ModelsClient
        initialFavoriteKeys={initialFavoriteKeys}
        isFavoritesMode={isFavoritesMode}
      />
    </div>
  );
}
