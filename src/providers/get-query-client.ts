import {
  QueryClient,
  QueryCache,
  MutationCache,
  defaultShouldDehydrateQuery,
  isServer,
} from "@tanstack/react-query";
import { STANDARD_CACHE_TTL } from "@/lib/cache/constants";

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        console.error("[React Query] Query error", {
          queryKey: query.queryKey,
          message: error.message,
        });
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        console.error("[React Query] Mutation error", {
          mutationKey: mutation.options.mutationKey,
          message: error.message,
        });
      },
    }),
    defaultOptions: {
      queries: {
        // Align staleTime with ISR cache window (12 hours)
        // Data is considered fresh for 12 hours, matching server-side cache
        staleTime: STANDARD_CACHE_TTL * 1000, // 12 hours in milliseconds
        // Keep data in cache longer (24 hours) to support instant navigation
        // This matches the server-side cache invalidation strategy
        gcTime: STANDARD_CACHE_TTL * 2 * 1000, // 24 hours in milliseconds
        // Follow TanStack Query guidance: automatically refetch stale data
        // when the tab regains focus so long-lived sessions stay fresh.
        // Individual queries can override this (e.g., table queries set to false)
        refetchOnWindowFocus: true,
      },
      dehydrate: {
        // include pending queries in dehydration
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient() {
  if (isServer) {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: make a new query client if we don't already have one
    // This is very important, so we don't re-make a new client if React
    // suspends during the initial render. This may not be needed if we
    // have a suspense boundary BELOW the creation of the query client
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}
