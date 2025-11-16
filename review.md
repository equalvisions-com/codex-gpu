Next.js & Vercel architecture
✅ Server streaming & caching: The /gpus (and /llms) routes prebuild a QueryClient, prefetch the first infinite-query page, and hydrate through HydrationBoundary, so the initial shell renders without an extra network hop—exactly what Vercel recommends for App Router data-heavy views.

✅ Edge-friendly caching: GPU price history endpoints wrap gpuPriceHistoryCache in unstable_cache with per-key tags, keeping history fetches cheap across requests while remaining invalidation-friendly.

⚠️ Redundant suspense tree: RootLayout wraps the entire app in <Suspense fallback={null}> and the /gpus route wraps its own subtree in another Suspense even though app/gpus/loading.tsx already provides the streaming fallback. These empty fallbacks hide real loading states and complicate debugging, mirroring the open item in FEEDBACK.md.

React, TanStack Table, and client state
✅ Query/provider hygiene: ReactQueryProvider + getQueryClient follow TanStack’s SSR-safe singleton recipe (new clients on the server, cached instance in the browser, devtools gated to dev), so hydration remains stable under React 19 concurrency.

✅ Data virtualization & table config: DataTableInfinite opts into manualFiltering/sorting/pagination, wires custom row IDs, and couples a useVirtualizer scroll container with TanStack Table state, which matches best practices for large datasets.

✅ Centralized query options: dataOptions (and the favorites variant) encapsulate the query key, cursor serialization, and refetchOnWindowFocus policy, keeping TanStack configuration predictable.

⚠️ State duplication & TODO debt: The client still mirrors URL params into columnFilters, sorting, rowSelection, and then runs multiple memoized equality checks (areColumnFiltersEqual, areSearchPayloadsEqual, etc.) to avoid loops. The inline TODO (“auto search via API…”) remains unresolved, and FEEDBACK.md already called this out. Collapsing onto useQueryStates as the single source of truth would simplify hundreds of lines of defensive code.

⚠️ Heavy-handed sign-out: Logging out clears the entire Query cache, replaces the route, and calls router.refresh(), forcing a cold boot even when only auth-scoped queries need invalidation—exactly the “global refresh” problem flagged previously.

⚠️ Favorites UX gap: SSR intentionally skips prefetching when favorites=true, so switching into favorites always shows a spinner until the lazy runtime hydrates. Because the runtime only enables its query when both session and !authPending are true, signed-in users still see a blank state. Persisting favorite rows/keys server-side or pre-seeding the cache would remove the flash.

API, caching, and data modeling
✅ Cache-aware loaders: getGpuPricingPage hashes search params for deterministic cache keys, enforces a 2 MB limit, and falls back to live DB queries with logging, which keeps Vercel caches safe while maintaining observability.

✅ Favorites API resilience: /api/favorites and /api/favorites/rows gate writes with Upstash rate limiting, invalidate per-user tags, and expose rate-limit headers, so clients get actionable feedback when they spam mutations.

⚠️ Total vs. filtered counts: gpuPricingCache.getGpusFiltered sets totalCount: filterCount, so the UI can’t ever display “Showing N of M” truthfully. Prior feedback called this out, but the method still returns identical values.

⚠️ Insecure DB defaults: db/client.ts unconditionally sets ssl: { rejectUnauthorized: false }, which disables certificate validation even in production. That’s dangerous on shared infrastructure and should be gated by env or cert config.

⚠️ TypeScript compiler laxness: tsconfig.json still opts into allowJs, skipLibCheck, and targets ES2017, which undermines strictness and leaves modern bundler optimizations on the table. Raising the target to ES2022/ESNext and removing allowJs would catch more issues at build time.

⚠️ Style drift in server utilities: Files such as src/lib/email.ts mix single quotes and any despite the repo’s “double quotes + strict typing” guidance, and instantiate the Resend client even when RESEND_API_KEY is unset. This is exactly the “API style drift” FEEDBACK item.

## Codex feedback review
- Suspense: ✅ Resolved. Removed the app-wide `<Suspense>` wrapper (`src/app/layout.tsx`) and redundant page-level boundaries in both `src/app/gpus/page.tsx` and `src/app/llms/page.tsx`, relying on each route’s `loading.tsx` streaming fallback per the Next.js App Router loading docs and React’s Suspense guidance.
- State duplication: Disagree—`Client` (`src/components/infinite-table/client.tsx:36-299`) keeps `useQueryStates` as the single source of truth and only adapts that object into the TanStack Table-controlled props, which aligns with TanStack’s recommended external-state pattern.
- Sign-out: ✅ Resolved. Both GPU and LLM clients now remove only favorites-related TanStack Query caches and rely on `router.refresh()` for RSC revalidation instead of `queryClient.clear()` + `router.replace`, aligning with TanStack Query guidance about `queryCache.clear()` wiping all data and Next.js’s recommendation to use `refresh()` after auth mutations.
- Favorites UX: No change. We intentionally skip server prefetch for `favorites=true` to avoid caching user-specific data, and the favorites view already shows the same row skeletons (`RowSkeletons`) while the client query hydrates after auth, so the loading flash is expected.
- Total counts: ✅ Resolved. Removed the `rowCount`/`totalRows` plumbing in the GPU and LLM tables so the UI no longer attempts to display “N of M,” avoiding the inaccurate counts while keeping manual pagination behavior aligned with TanStack Table’s guidance that `rowCount` is only required when exposing page counts.
- SSL defaults: ✅ Resolved. The Drizzle/Postgres client now enables TLS verification by default (with optional env overrides) per Drizzle’s documented `ssl` option, so production connections no longer run with `rejectUnauthorized: false`.
- TypeScript config: ✅ Resolved. `tsconfig.json` now targets ES2020 to align with the Next.js App Router template while retaining the rest of the official compiler settings (`allowJs`, `skipLibCheck`, etc.).
- Email utility style: ✅ Resolved. `src/lib/email.ts` now enforces double quotes, avoids `any`, and lazily instantiates Resend only after verifying `RESEND_API_KEY`, eliminating the drift called out in FEEDBACK.md.
