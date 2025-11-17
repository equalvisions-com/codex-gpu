Gaps & Risks
Non-standard searchParams typing: GpusPage declares searchParams as a Promise, then awaits it. App Router delivers a plain object, so this pattern introduces unnecessary async work and risks type drift as Next.js evolves. Consider searchParams?: Record<string, string | string[] | undefined> and synchronous parsing.

Error handling visibility: Server-side prefetch errors are only logged with console.error/console.warn and hydration proceeds with empty data. Users get no feedback beyond the client’s loading state, and observability is limited. A surfaced user-facing fallback or error boundary for the prefetched segment would improve resilience.

Experimental React Compiler flag: reactCompiler: true is enabled globally. This is still experimental; without per-component opt-in or measurements, it may introduce regressions and complicate debugging. Guarding with environment toggles or rollout plans would be safer.

Default metadata stub: The app title is hardcoded to "D", which undermines SEO/share previews. Using a meaningful brand/title and deriving description per route would better leverage Next’s metadata system.

Cache blast potential: getCachedGpusFiltered keys each unique search input; high-cardinality search params could create many cache entries and waste memory. Adding normalization/limits on sortable/filterable params or tightening TTL for highly variable keys would align better with Vercel edge cache guidance.