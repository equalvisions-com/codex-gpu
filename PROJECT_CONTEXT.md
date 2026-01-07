# Deploybase - Project Context

> **Purpose of this document**: Shared understanding of what we're building, design rationale, and key decisions. Reference this to stay aligned on product vision and technical direction.

---

## What is Deploybase?

Deploybase is an **AI infrastructure aggregator platform** — a one-stop comparison tool for developers and teams evaluating AI/ML resources. It's NOT a typical SaaS marketing site; it's a **data-dense research tool** built for power users who need to make informed decisions quickly.

### Core Data Sections

| Section | Description | Key Data Points |
|---------|-------------|-----------------|
| **GPU Cloud Pricing** | Aggregates GPU cloud offerings from providers like Coreweave, Crusoe, Google, etc. | Hardware specs, configurations, hourly rates |
| **LLM Aggregator** | 700+ LLM models from API providers like Google Vertex, Groq, Baseten, OpenAI, Anthropic, etc. | Model name, provider, prompt/output pricing, context window, modalities |
| **AI/ML Tools** | Curated aggregator of AI/ML tools and frameworks | License, language, description, use case |

### Target Users

- **Startups/scale-ups** evaluating GPU providers for training or inference
- **Developers** comparing LLM APIs for their applications
- **ML engineers** researching tooling for their stack

---

## UI/UX Philosophy

### Data Density Over Flash

This app prioritizes **scanability and information density** over visual aesthetics. Users come here to compare 700+ models or dozens of GPU configs — they need:

- Quick visual scanning
- Efficient filtering
- Minimal distraction from the actual data

**This is intentional.** Apps like Bloomberg Terminal, Grafana, and GitHub's code views follow this same principle: **readability > aesthetics** for data-heavy tools.

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Monochromatic dark theme** | Reduces visual noise, easy on the eyes for extended use, dev-friendly |
| **Provider logos in table rows** | Adds visual differentiation without overwhelming color — enables fast scanning |
| **Minimal accent colors** | Too many colors distract from the data; restraint is a feature, not a limitation |
| **Dense table layout** | Power users want to see more data at once, not paginated cards |
| **Hover states on rows** | Provides interactivity feedback without adding persistent visual weight |
| **Slider filters for numeric ranges** | More intuitive for price/context filtering than input fields |

### What We DON'T Want

- ❌ Heavy gradients and glows everywhere
- ❌ Excessive whitespace that wastes screen real estate
- ❌ Marketing-style hero sections on data pages
- ❌ Animations that slow down data interaction

---

## Technical Architecture

### Core Framework
| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 16.x | App Router, RSC, API routes |
| **React** | 19.x | UI library (with React Compiler) |
| **TypeScript** | 5.x | Type safety |

### Data & Tables
| Technology | Purpose |
|------------|---------|
| **Tanstack Table** | Headless table logic, sorting, filtering, pagination |
| **Tanstack Query** | Server state management, caching, data fetching |
| **Tanstack Virtual** | Virtualized rendering for large datasets |
| **nuqs** | URL state management — syncs filters to URL for shareability |
| **Zod** | Schema validation for data and forms |

### Database & ORM
| Technology | Purpose |
|------------|---------|
| **Drizzle ORM** | Type-safe database queries |
| **PostgreSQL** | Primary database (hosted on PlanetScale) |

### Authentication & Email
| Technology | Purpose |
|------------|---------|
| **Better Auth** | Authentication system |
| **Resend** | Transactional email delivery |
| **React Email** | Email templates |

### Infrastructure & Deployment
| Technology | Purpose |
|------------|---------|
| **Vercel** | Hosting, edge functions, cron jobs |
| **Vercel Analytics** | Usage analytics |
| **Vercel Speed Insights** | Performance monitoring |
| **OpenTelemetry** | Observability/tracing |
| **Upstash Redis** | Rate limiting |
| **Upstash Qstash** | Cron jobs |

### Styling & UI
| Technology | Purpose |
|------------|---------|
| **Tailwind CSS** | Utility-first styling |
| **shadcn/ui** | Component library (Radix-based) |
| **Radix UI** | Accessible primitives (dialogs, dropdowns, sliders, etc.) |
| **Lucide React** | Icon library |
| **Geist** | Font family |
| **next-themes** | Dark/light mode |
| **Recharts** | Data visualization/charts |

### Dev Tooling
| Technology | Purpose |
|------------|---------|
| **pnpm** | Package manager |
| **ESLint** | Linting |
| **Prettier** | Code formatting |
| **Drizzle Kit** | Database migrations |
| **Knip** | Unused code detection |
| **Bundle Analyzer** | Build analysis |

---

## Development Status

Currently in active development. Focus areas:

- [ ] Core table functionality and filtering
- [ ] Data accuracy and coverage
- [ ] Performance optimization for large datasets (700+ models)
- [ ] Authentication and user features
- [ ] Future: Branding, logos, marketing pages

---

## Code Standards (MANDATORY)

> ⚠️ **These standards are non-negotiable.** Every piece of code written for this project must follow these principles.

### Enterprise-Grade Code

This is not a hobby project. We write **enterprise-grade, production-ready code** that:
- Could be handed off to any senior engineer and understood immediately
- Handles edge cases and errors gracefully
- Is secure, performant, and maintainable
- Would pass a rigorous code review at a top tech company

### 1. Best Practices First

- Always use established best practices for the framework/library in use
- No shortcuts, hacks, or "it works for now" solutions
- Code should be production-ready from the start, not "we'll fix it later"
- Prioritize maintainability and readability

### 2. Modern Patterns Only

- Use the latest stable patterns and APIs (e.g., App Router over Pages Router, Server Components where appropriate)
- Avoid deprecated methods or legacy approaches
- Stay current with React 19 patterns, Next.js 16 features, etc.
- If a newer, better approach exists — use it

### 3. Documentation-Driven Development

- **Always check official documentation** before implementing anything
- Use the **Context7 MCP tool** to retrieve current docs for any library/framework
- When in doubt, fetch the docs for the recommended approach
- Key libraries to check docs for: Next.js, React, Tanstack Table, Tanstack Query, Drizzle, Better Auth, nuqs, Zod
- Don't rely on memory or assumptions — verify against current docs

### 4. Lean Code Philosophy

> **We write lean, streamlined, clean code. Always.**

- **No over-engineering** — don't complicate simple problems
- **No changes for the sake of changes** — if something works well, leave it alone
- **No bloat** — every line of code should earn its place
- **Right decisions, no shortcuts** — lean doesn't mean lazy; it means intentional
- **Be honest** — if code is already optimized and production-ready, say so
  - Don't suggest refactors just to have something to suggest
  - Have the humility to recommend "no changes needed" when appropriate
  - Mark code as ready for production when it truly is

### 5. Brutal Honesty

- Give **brutally honest but fair** feedback
- If something is wrong, say it clearly
- If something is good, acknowledge it
- Don't sugarcoat issues, but don't be harsh for the sake of being harsh

### 6. Type Safety (CRITICAL)

> TypeScript best practices and type safety are **extremely important** in this codebase.

- **Zero tolerance for `any`** — no `any` types unless absolutely unavoidable (and must be justified)
- Prefer `unknown` over `any` when type is truly unknown
- Use strict TypeScript config — no loose typing
- Use Zod for runtime validation at API boundaries
- Leverage Drizzle's type inference for database operations
- Proper generics over repeated type definitions
- Explicit return types on exported functions
- Use discriminated unions for complex state

### 7. Comments — Smart, Not Excessive

- Comments where appropriate, **never for the sake of it**
- Code should be self-documenting through clear naming
- Comment the **why**, not the **what** (the code shows what)
- Complex business logic or non-obvious decisions deserve comments
- Don't comment obvious code — it's noise
- JSDoc for exported functions/components that others will use

### 8. Performance by Default

- Consider bundle size implications
- Use dynamic imports for heavy components
- Leverage React Server Components where possible
- Virtualize large lists (we have 700+ models)

---

## Notes for AI Assistants

When working on this codebase:

1. **ALWAYS check the official documentation** before suggesting implementations — use the Context7 MCP tool or fetch docs directly
2. **Respect the data-first design philosophy** — don't suggest flashy UI changes that compromise data readability
3. **Use modern patterns** — if you're unsure whether something is the current best practice, look it up
4. **Performance matters** — we're rendering large datasets, optimize accordingly
5. **The three sections share patterns** — look for reusable filter/table components
6. **URL state is important** — nuqs syncs filters to URL for shareability
7. **This is a power-user tool** — optimize for efficiency, not first-time onboarding
8. **No legacy patterns** — if Next.js or React has a newer way to do something, use it

---

*Last updated: December 15, 2024*
