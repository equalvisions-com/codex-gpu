

Resolved items noted in the review:

- Suspense boundaries rely on route-level `loading.tsx` plus a small Suspense wrapper around `AuthDialogProvider` to satisfy `useSearchParams` requirements.
- Sign-out clears only favorites-related queries and uses `router.refresh()`, avoiding global cache nukes.
- Favorites intentionally skip server prefetch to avoid caching user-specific data; the client shows row skeletons while the auth-gated query hydrates.
- Drizzle/Postgres SSL now defaults to `rejectUnauthorized: true` unless overridden, matching Drizzle’s SSL guidance.
- TypeScript `target` bumped to ES2020 (per Next.js docs).
- `src/lib/email.ts` now enforces double quotes, typed payloads, and lazy Resend instantiation.
- Unfiltered totals: `gpuPricingCache.getGpusFiltered` (and the models equivalent) still returns `totalCount === filterCount`. That’s acceptable for pagination today because the UI only needs filtered counts; we’ll add an unfiltered total later if a feature (reports/exports) actually needs it.
- TypeScript strictness: `tsconfig.json` now targets ES2020, but we still allow JS files and skip lib checks. That matches the official Next.js template, so tightening further is optional; we can revisit if we ever want “stricter than Next defaults.”
- Client component complexity: Refactored. `Client` and `ModelsClient` now delegate URL/filter/favorites logic to dedicated hooks (`useTableSearchState`, `useFavoritesState`), leaving the components focused on rendering per React/TanStack guidance.
