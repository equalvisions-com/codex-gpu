# Repository Guidelines

This repo powers OpenStatus data-table demos on the Next.js App Router.

## Frameworks & Key Packages
- **Next.js 15 + React 19**: App Router with server components; skip `pages/_app` `getInitialProps` because it disables automatic optimizations per Next.js docs.
- **TanStack Query/Table/Virtual**: Query caching, table state, virtualization; keep hooks in `src/hooks`.
- **Shadcn/UI + Tailwind CSS**: UI primitives and styling; favor utility classes and `tailwind-merge`.
- **Drizzle ORM + PostgreSQL**: Schema-first database layer; keep `src/db` in sync with `drizzle/` migrations.
- **Better Auth + Upstash**: Auth scaffolding and rate limiting; regen bindings when auth routes change.

## Project Structure & Module Organization
- `src/app`: Route groups and `api/*` handlers.
- `src/components`, `src/hooks`, `src/providers`, `src/lib`: Keep UI, hooks, providers, server utilities separate; add barrels only when needed.
- `src/db`, `drizzle/`: Drizzle schema and generated SQL—commit schema changes with the generated migration.
- `public/`, `docs/`, `scripts/`: Static assets, docs, automation.

## Build, Test & Development Commands
- `pnpm dev`: Run the local Next.js server at `http://localhost:3000`.
- `pnpm build` → `pnpm start`: Compile and serve the production bundle.
- `pnpm lint`, `pnpm tsc`: Mandatory static analysis pre-push.
- `pnpm format`: Apply Prettier (sorted imports and Tailwind plugins).
- `pnpm db:gen`, `pnpm db:push`: Update Drizzle types and apply schema changes.
- `pnpm auth:generate`, `pnpm auth:migrate`: Refresh Better Auth artifacts after auth edits.

## Coding Style & Naming
- TypeScript/TSX with 2-space indentation and double quotes; rely on Prettier and ESLint (Next.js defaults).
- Components in `PascalCase`, hooks in `camelCase` prefixed with `use`, route segments in kebab-case to match URLs.
- Keep client/server boundaries explicit: data loaders in `src/lib` or `src/db`, UI in components, shared state in providers.

## Testing Guidelines
- Treat `pnpm lint` and `pnpm tsc` as the regression baseline; document manual checks in PRs (e.g. visit `/infinite` to confirm row expansion).
- When adding automated tests, colocate `.test.ts(x)` files with the source and wire runners into `package.json`.

## Quality Expectations
- Always pull official docs via the Context7 MCP server before adopting APIs to stay textbook.
- Deliver enterprise-grade code: prefer composable abstractions, avoid hacks, document trade-offs or TODOs with owner and intent.

## Commit & Pull Request Guidelines
- Use concise, imperative commits mirroring history (`new nav`, `toast notifications`) and group related work.
- Pull requests must include a summary, test evidence, media for UI changes, and note schema or auth updates with the required `pnpm` commands.
