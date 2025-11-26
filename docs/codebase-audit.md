# Codebase Audit (Next.js + TanStack Table)

## Summary
- Data explorers share a single infinite-table shell (`DataTableInfinite`) plus a hydration wrapper, grouped under `src/features/data-explorer` for clearer ownership and reuse.
- GPU and LLM routes stay lean: they parse search params once, reuse the shared query options, and only add dataset-specific schema metadata.
- URL state, prefetching, and structured data injection are centralized so ISR-friendly pages remain static while clients hydrate instantly.

## Evidence of Best Practices
- **Shared table shell**: `DataTableInfinite` owns navigation, checked-row actions, virtualization, and lazy sheet charts. Both GPU and LLM clients consume it instead of bespoke copies. 【F:src/features/data-explorer/table/data-table-infinite.tsx†L1-L115】【F:src/features/data-explorer/models/models-client.tsx†L12-L117】
- **Shared hydration + schema**: `HydratedInfinitePage` prefetches via `@tanstack/react-query`, injects structured data, and wraps client shells in a consistent layout. GPU and LLM pages import it directly. 【F:src/features/data-explorer/hydration/hydrated-infinite-page.tsx†L1-L84】【F:src/app/gpus/page.tsx†L15-L49】【F:src/app/llms/page.tsx†L15-L41】
- **Nuqs-driven URL parsing**: Search params are parsed/serialized once with `createSearchParamsCache`, keeping server loaders and clients aligned on pagination and filters. 【F:src/features/data-explorer/table/search-params.ts†L1-L50】【F:src/features/data-explorer/models/models-search-params.ts†L1-L49】
- **Feature-first file tree**: All data-explorer UI lives under `src/features/data-explorer/{data-table,table,models,hydration}` to keep shared primitives and domain-specific pieces colocated. Routes stay under `src/app`, and loaders remain in `src/lib`. 【F:src/features/data-explorer/table/client.tsx†L1-L20】【F:src/features/data-explorer/models/models-columns.tsx†L1-L22】

## Redundancy Check
- The legacy model-specific table was removed; both explorers now import the same `DataTableInfinite` and only customize columns, filters, and sheet charts. 【F:src/features/data-explorer/models/models-client.tsx†L188-L280】
- Search-param handling, favorites broadcasting, and hydration wrappers are centralized, eliminating duplicate logic across GPU and LLM flows. 【F:src/features/data-explorer/table/hooks/use-table-search-state.ts†L1-L52】【F:src/features/data-explorer/hydration/hydrated-infinite-page.tsx†L27-L83】

## Overall Assessment
The codebase aligns with Next.js App Router conventions, TanStack Query/Table patterns, nuqs for URL state, and Vercel-friendly ISR. With the feature-first data-explorer folder, the tree is concise and duplication-free (ignoring the placeholder root and tools pages).
