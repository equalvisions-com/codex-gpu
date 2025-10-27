import * as React from "react";
import { modelsSearchParamsCache } from "@/components/models-table/models-search-params";
import { getQueryClient } from "@/providers/get-query-client";
import { modelsDataOptions } from "@/components/models-table/models-query-options";
import { ModelsClient } from "@/components/models-table/models-client";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getCookieCache } from "better-auth/cookies";
import type { Session } from "@/lib/auth-client";
import { getUserModelFavoritesFromCache } from "@/lib/model-favorites/cache";
import { modelsCache } from "@/lib/models-cache";
import { stableModelKey } from "@/components/models-table/stable-key";
import type { ModelsColumnSchema } from "@/components/models-table/models-schema";
import { unstable_cache } from "next/cache";

export default async function Models({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const isFavoritesMode = params.favorites === "true";
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

  const getAllModelsCached = unstable_cache(
    async () => {
      return await modelsCache.getAllModels();
    },
    ["models:rows"],
    { revalidate: 900, tags: ["models"] },
  );

  let initialFavoriteKeys: string[] | undefined;
  let initialFavoritesData: ModelsColumnSchema[] | undefined;
  if (session) {
    initialFavoriteKeys = await getUserModelFavoritesFromCache(session.user.id);

    if (isFavoritesMode && initialFavoriteKeys.length > 0) {
      const allModels = await getAllModelsCached();
      const favoriteSet = new Set(initialFavoriteKeys);
      initialFavoritesData = allModels
        .map((model) => ({
          id: model.id,
          slug: model.slug,
          provider: model.provider,
          name: model.name ?? null,
          shortName: model.shortName ?? null,
          author: model.author ?? null,
          description: model.description ?? null,
          modelVersionGroupId: model.modelVersionGroupId ?? null,
          contextLength: model.contextLength ?? null,
          inputModalities: model.inputModalities ?? [],
          outputModalities: model.outputModalities ?? [],
          hasTextOutput: model.hasTextOutput ?? "false",
          group: model.group ?? null,
          instructType: model.instructType ?? null,
          permaslug: model.permaslug ?? null,
          mmlu: model.mmlu ?? null,
          pricing: model.pricing ?? {},
          scrapedAt: model.scrapedAt,
        }))
        .filter((row) => favoriteSet.has(stableModelKey(row)));
    }
  }

  return (
    <div
      className="flex min-h-dvh w-full flex-col sm:flex-row pt-4 sm:p-6 min-h-0"
      style={{
        '--total-padding-mobile': '2rem',
        '--total-padding-desktop': '3rem',
      } as React.CSSProperties}
    >
      <ModelsClient
        initialFavoritesData={initialFavoritesData}
        initialFavoriteKeys={initialFavoriteKeys}
      />
    </div>
  );
}
