import * as React from "react";
import { modelsSearchParamsCache } from "@/components/models-table/models-search-params";
import { getQueryClient } from "@/providers/get-query-client";
import { modelsDataOptions } from "@/components/models-table/models-query-options";
import { ModelsClient } from "@/components/models-table/models-client";
import { ModelsNavBar } from "@/components/layout/models-nav-bar";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getCookieCache } from "better-auth/cookies";
import type { Session } from "@/lib/auth-client";

export default async function Models({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const search = modelsSearchParamsCache.parse(params);
  const queryClient = getQueryClient();
  const prefetchPromise = queryClient.prefetchInfiniteQuery(modelsDataOptions(search));

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
    // TODO: Implement AI models favorites when needed
    initialFavoriteKeys = [];
  }

  return (
    <div className="min-h-screen">
      <ModelsNavBar />
      <ModelsClient initialFavoriteKeys={initialFavoriteKeys} />
    </div>
  );
}
