import * as React from "react";
import { searchParamsCache } from "@/components/infinite-table/search-params";
import { getQueryClient } from "@/providers/get-query-client";
import { dataOptions } from "@/components/infinite-table/query-options";
import { Client } from "@/components/infinite-table/client";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getCookieCache } from "better-auth/cookies";
import type { Session } from "@/lib/auth-client";

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
  // Start cookie cache check in parallel with prefetch (both are fast, no DB hits)
  const cookieCachePromise = getCookieCache(new Headers(hdrs), {
    secret: process.env.BETTER_AUTH_SECRET,
  }) as Promise<Session | null>;
  
  // Wait for cookie cache result first (it's very fast, ~1-5ms)
  // This allows us to start DB hit immediately if cache misses, without waiting for prefetch
  const sessionFromCookie = await cookieCachePromise;
  
  // If cookie cache missed, start DB hit immediately (in parallel with prefetch)
  // If cookie cache hit, use it (no DB hit needed)
  const sessionPromise = sessionFromCookie
    ? Promise.resolve(sessionFromCookie)
    : auth.api.getSession({ headers: hdrs });
  
  // Wait for both prefetch and session in parallel
  // This ensures DB hit (if needed) runs concurrently with prefetch, not sequentially
  const [, session] = await Promise.all([
    prefetchPromise,
    sessionPromise,
  ]);

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
        "--total-padding-mobile": "calc(0.5rem + 0.5rem)",
        "--total-padding-desktop": "3rem",
      } as React.CSSProperties}
    >
      <Client
        initialFavoriteKeys={initialFavoriteKeys}
        isFavoritesMode={isFavoritesMode}
      />
    </div>
  );
}
