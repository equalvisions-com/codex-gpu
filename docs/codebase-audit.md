# Codebase audit snapshot

## Reuse and redundancy
- The shared `useFavoritesRuntime` hook powers both GPU and model favorites, eliminating duplicate pagination, memoization, and broadcast-sync logic while letting each runtime supply domain-specific options.
- Stable key generation for GPUs and models is centralized in `src/features/data-explorer/stable-keys.ts`, keeping favorites and persistence identifiers consistent across features.
- The `HydratedInfinitePage` server component provides a reusable pattern for ISR-friendly prefetch + client hydration across both `/gpus` and `/llms`, reducing repeated boilerplate for schema metadata, Nuqs parsing, and initial React Query hydration.

## Framework and library practices
- The root layout wires providers for Better Auth, React Query, Nuqs, and theming with Suspense wrapping, matching Next.js App Router guidance while keeping metadata and viewport declarations colocated.
- React Query defaults include focus refetching and pending-query dehydration plus console-based error logging hooks, aligning with TanStack Query recommendations for long-lived sessions and observability.
- Nuqs search state is isolated in dedicated hooks (`useTableSearchState` / `useModelsTableSearchState`) and server-side parsing caches, preventing client directives in RSC files while keeping URL filters consistent.
- Vercel OTel instrumentation is registered globally so trace IDs flow through route handlers and logs.

## Gaps / enterprise readiness risks
- The homepage remains a placeholder (`Hi`) with no UX, loading, or error surfaces, falling short of enterprise expectations for polish and resilience.
- Data explorer routes ship client-facing error boundaries but no route-level loading UI, so initial renders on slow connections fall back to blank states instead of skeletons.
- Table state management still relies on a TODO to move controlled state fully outside `useReactTable`, leaving some coupling that could complicate persistence or server-driven state in the future.
