import * as React from "react";
import { cpuSearchParamsCache } from "@/components/cpu-table/cpu-search-params";
import { getQueryClient } from "@/providers/get-query-client";
import { cpuDataOptions } from "@/components/cpu-table/cpu-query-options";
import { CpuClient } from "@/components/cpu-table/cpu-client";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { pricingCache } from "@/lib/redis";
import { createHash } from "crypto";
import { unstable_cache } from "next/cache";
import type { CpuColumnSchema } from "@/components/cpu-table/cpu-schema";
import { stableCpuKey } from "@/lib/favorites/cpu-stable-key";
import { getUserCpuFavoritesFromCache } from "@/lib/favorites/cpu-cache";
import { getCookieCache } from "better-auth/cookies";
import type { Session } from "@/lib/auth-client";

export default async function Cpus({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const isFavoritesMode = params.favorites === 'true';

  if (isFavoritesMode) {
    // Start snapshots fetch immediately; fetch session in parallel
    const getSnapshotsCached = unstable_cache(
      async () => {
        return await pricingCache.getAllPricingSnapshots();
      },
      ["pricing:snapshots"],
      { revalidate: 900, tags: ["pricing"] }
    );
    const snapshotsPromise = getSnapshotsCached();

    const hdrsForFav = await headers();
    const sessionFromCookie = await getCookieCache(new Headers(hdrsForFav), {
      secret: process.env.BETTER_AUTH_SECRET,
    }) as Session | null;
    const [session, pricingSnapshots] = await Promise.all([
      sessionFromCookie
        ? Promise.resolve(sessionFromCookie)
        : auth.api.getSession({ headers: hdrsForFav }),
      snapshotsPromise,
    ]);

    if (!session) {
      // Redirect to signin if not authenticated
      return <div>Please sign in to view favorites</div>;
    }

    // Flatten all pricing data, only CPU class rows
    const allCpuData: CpuColumnSchema[] = pricingSnapshots.flatMap((snapshot: any) =>
      snapshot.rows
        .filter((row: any) => row.class === 'CPU')
        .map((row: any) => {
          const observedAt = snapshot.last_updated;
          const hashInput = JSON.stringify({ provider: snapshot.provider, observed_at: observedAt, row });
          const uuid = createHash("sha256").update(hashInput).digest("hex");
          return {
            uuid,
            ...row,
            provider: snapshot.provider,
            observed_at: observedAt,
          } as CpuColumnSchema;
        })
    );

    // Fetch user's CPU favorites with caching
    const initialFavoriteKeys: string[] = await getUserCpuFavoritesFromCache(session.user.id);
    const favoriteKeys = new Set<string>(initialFavoriteKeys);

    // Filter data to only show favorites (compare by stable key, not volatile uuid)
    const favoritesFilteredData = allCpuData.filter(row => favoriteKeys.has(stableCpuKey(row)));

    return <CpuClient initialFavoritesData={favoritesFilteredData} initialFavoriteKeys={initialFavoriteKeys} />;
  }

  // Normal mode - show all data
  const search = cpuSearchParamsCache.parse(params);
  const queryClient = getQueryClient();
  const prefetchPromise = queryClient.prefetchInfiniteQuery(cpuDataOptions(search));

  // Prehydrate favorites keys for authed users to avoid flicker on first selection
  const hdrs = await headers();
  const sessionFromCookie = await getCookieCache(new Headers(hdrs), {
    secret: process.env.BETTER_AUTH_SECRET,
  }) as Session | null;
  const sessionPromise = sessionFromCookie
    ? Promise.resolve(sessionFromCookie)
    : auth.api.getSession({ headers: hdrs });
  const [, session] = await Promise.all([
    prefetchPromise,
    sessionFromCookie ? Promise.resolve(sessionFromCookie) : auth.api.getSession({ headers: hdrs }),
  ]);

  let initialFavoriteKeys: string[] | undefined;
  if (session) {
    initialFavoriteKeys = await getUserCpuFavoritesFromCache(session.user.id);
  }

  return <CpuClient initialFavoriteKeys={initialFavoriteKeys} />;
}
