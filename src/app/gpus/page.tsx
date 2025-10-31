import * as React from "react";
import { searchParamsCache } from "@/components/infinite-table/search-params";
import { getQueryClient } from "@/providers/get-query-client";
import { dataOptions } from "@/components/infinite-table/query-options";
import { Client } from "@/components/infinite-table/client";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getUserFavoritesFromCache } from "@/lib/favorites/cache";
import { getCookieCache } from "better-auth/cookies";
import type { Session } from "@/lib/auth-client";
import { unstable_cache } from "next/cache";
import { gpuPricingStore } from "@/lib/gpu-pricing-store";
import { stableGpuKey } from "@/components/infinite-table/stable-key";

export default async function Gpus({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const isFavoritesMode = params.favorites === "true";
  const search = searchParamsCache.parse(params);

  const queryClient = getQueryClient();
  const prefetchPromise = queryClient.prefetchInfiniteQuery(dataOptions(search));

  const hdrs = await headers();
  const sessionFromCookie = await getCookieCache(new Headers(hdrs), {
    secret: process.env.BETTER_AUTH_SECRET,
  }) as Session | null;
  const sessionPromise = sessionFromCookie
    ? Promise.resolve(sessionFromCookie)
    : auth.api.getSession({ headers: hdrs });
  const [, session] = await Promise.all([
    prefetchPromise,
    sessionPromise,
  ]);

  const getPricingRows = unstable_cache(
    async () => {
      return await gpuPricingStore.getAllRows();
    },
    ["pricing:rows"],
    { revalidate: 900, tags: ["pricing"] },
  );

  let initialFavoriteKeys: string[] | undefined;
  let initialFavoritesData:
    | Awaited<ReturnType<typeof gpuPricingStore.getAllRows>>
    | undefined;

  if (session) {
    initialFavoriteKeys = await getUserFavoritesFromCache(session.user.id);

    if (isFavoritesMode && initialFavoriteKeys.length > 0) {
      const pricingRows = await getPricingRows();
      const favoriteKeys = new Set(initialFavoriteKeys);
      initialFavoritesData = pricingRows
        .filter((row) => favoriteKeys.has(stableGpuKey(row)));
    }
  }

  if (isFavoritesMode && !session) {
    return <div>Please sign in to view favorites</div>;
  }

  return (
    <div
      className="flex min-h-dvh w-full flex-col sm:flex-row pt-2 sm:p-0 min-h-0"
      style={{
        "--total-padding-mobile": "calc(0.5rem + 0.5rem)",
        "--total-padding-desktop": "3rem",
      } as React.CSSProperties}
    >
      <Client
        initialFavoritesData={initialFavoritesData}
        initialFavoriteKeys={initialFavoriteKeys}
      />
    </div>
  );
}
