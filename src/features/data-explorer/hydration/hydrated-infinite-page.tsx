import * as React from "react";
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
  type QueryKey,
} from "@tanstack/react-query";
import { cn } from "@/lib/utils";

type BaseSearchParams = {
  size?: number | null;
  bookmarks?: string | null;
};

type PrefetchInfiniteOptions = { queryKey: QueryKey } & Record<string, unknown>;

type HydratedInfinitePageProps<TSearch extends BaseSearchParams, TPayload> = {
  parseSearch: () => TSearch;
  getInfiniteOptions: (search: TSearch) => {
    queryKey: QueryKey;
  };
  fetchPage: (
    params: TSearch & { cursor: number | null; size: number; uuid: string | null },
  ) => Promise<TPayload>;
  renderClient: React.ComponentType;
  buildSchema?: (payload: TPayload | null) => Record<string, unknown> | null;
  shouldPrefetch?: (search: TSearch) => boolean;
  logTag?: string;
  contentClassName?: string;
  contentStyle?: React.CSSProperties;
};

const DEFAULT_CONTAINER_STYLE = {
  "--total-padding-mobile": "calc(0.5rem + 0.5rem)",
  "--total-padding-desktop": "3rem",
} as React.CSSProperties;

export async function HydratedInfinitePage<
  TSearch extends BaseSearchParams,
  TPayload,
>({
  parseSearch,
  getInfiniteOptions,
  fetchPage,
  renderClient: ClientComponent,
  buildSchema,
  shouldPrefetch = () => true,
  logTag = "HydratedInfinitePage",
  contentClassName = "flex min-h-dvh w-full flex-col sm:flex-row pt-2 sm:p-0",
  contentStyle = DEFAULT_CONTAINER_STYLE,
}: HydratedInfinitePageProps<TSearch, TPayload>) {
  const parsedSearch = parseSearch();
  const queryClient = new QueryClient();
  let firstPagePayload: TPayload | null = null;

  if (shouldPrefetch(parsedSearch)) {
    try {
      const infiniteOptions = getInfiniteOptions(parsedSearch) as PrefetchInfiniteOptions;
      const initialPageParam =
        (infiniteOptions.initialPageParam as { cursor?: number | null; size?: number } | undefined) ?? {
          cursor: null as number | null,
          size: parsedSearch.size ?? 50,
        };

      await queryClient.prefetchInfiniteQuery({
        ...infiniteOptions,
        queryFn: async ({ pageParam }) => {
          const cursor =
            typeof pageParam?.cursor === "number" ? pageParam.cursor : null;
          const size =
            (pageParam as { size?: number } | undefined)?.size ??
            parsedSearch.size ??
            50;
          const result = await fetchPage({
            ...parsedSearch,
            cursor,
            size,
            uuid: null,
          });

          if (!firstPagePayload && (cursor === null || cursor === 0)) {
            firstPagePayload = result;
          }

          return result;
        },
        initialPageParam,
      });
    } catch (error) {
      console.error(`[${logTag}] Failed to prefetch data`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const dehydratedState = dehydrate(queryClient);
  const schemaMarkup = buildSchema ? buildSchema(firstPagePayload) : null;

  return (
    <HydrationBoundary state={dehydratedState}>
      {schemaMarkup ? (
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schemaMarkup).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}
      <div className={cn(contentClassName)} style={contentStyle}>
        <ClientComponent />
      </div>
    </HydrationBoundary>
  );
}
