# AGENTS.md

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Critical Commands

```bash
# Development
npm run dev              # Start dev server (Turbopack by default)
npm run build            # Production build (Turbopack by default)
npm run start            # Start production server

# Testing & Quality
npm run lint             # ESLint with flat config (eslint.config.mjs)
npm run test             # Vitest in watch mode
npm run test:run         # Vitest single run
npx next typegen         # Generate type helpers for async params/searchParams

# Order matters: lint -> typecheck -> test
```

## Next.js 16.2.1 Breaking Changes

**Always `await` dynamic APIs** - synchronous access is fully removed:
```ts
// cookies, headers, draftMode, params, searchParams are all async
const cookieStore = await cookies()
const { slug } = await params
```

**`middleware` renamed to `proxy`** - use `src/proxy.ts`

**Image generation functions** - `params` and `id` are now `Promise`s

**Sitemap `id`** parameter is now a `Promise<string>`

Run `npx next typegen` before implementing new pages/routes.

## Project Structure & Architecture

- **Next.js 16.2.1** with App Router (`src/app/`)
- **React 19.2.4** - latest version with new hooks
- **TypeScript 5** with strict mode and path alias `@/*` → `./src/*`
- **Tailwind CSS v4** - configured via `@import "tailwindcss"` and `@theme inline` (NOT v3 `@tailwind` directives)
- **shadcn/ui v4** with custom theme (`components.json`)

### Key Directories
- `src/app/(dashboard)/` - Protected dashboard routes with auth layout
- `src/app/(auth)/` - Public auth routes (login, register, reset-password)
- `src/app/api/` - API routes for data processing
- `src/lib/` - Business logic, data sources, utilities
- `supabase/migrations/` - Database migrations
- `src/components/ui/` - shadcn/ui components

### Financial Analysis Modules
- **Options**: Black-Scholes calculations, hedge strategies, Yahoo Finance integration
- **Causal Analysis**: Portfolio analysis with DAGs, discovery, backtesting
- **Peter Lynch**: Stock screener implementation
- **Informes**: DOCX report generation from financial data

## External Dependencies

**Next.js 16.2.1 requires these packages** in `serverExternalPackages`:
```ts
// next.config.ts
serverExternalPackages: ['yahoo-finance2', 'xlsx', 'mathjs', 'docx']
```

## Testing Setup

- **Vitest + React Testing Library** (not Jest)
- **jsdom** environment in `vitest.config.ts`
- **Path alias** configured: `@/*` → `./src/*`
- Setup file: `src/test/setup.ts` (loads jest-dom matchers)

Run tests:
```bash
npm run test             # Watch mode
npm run test:run         # Single run
```

## Database & Supabase

- **Supabase** for auth and data storage
- **Migration files** in `supabase/migrations/`
- **Server-side** auth via `src/lib/supabase/server.ts`
- **Client-side** auth via `src/lib/supabase/client.ts`

## Development Server Configuration

**Dev server allows specific origin** (hardcoded IP):
```ts
// next.config.ts
allowedDevOrigins: ['217.216.92.14']
```

Remove or change this for local development outside the office.

## ESLint Configuration

**ESLint 9** with flat config only:
- Config: `eslint.config.mjs`
- Extends: `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`
- No traditional `.eslintrc` files

## Style & Code Conventions

- **Tailwind v4** uses `@import "tailwindcss"` and `@theme inline` directives
- **CVA** (class-variance-authority) for component variants
- **shadcn/ui** patterns with custom theme
- **Lucide React** icons
- **Framer Motion** for animations

## Memory System

**Progress tracking** required:
- Create/update `.md` files with progress notes
- Before session end: save summary of completed/in-progress work
- At session start: read existing progress files
- Sections: "Completado", "En progreso", "Pendiente", "Decisiones tomadas"

## Environment & Dependencies

**Required for development:**
- **Node.js** with ES2017+ support
- **Supabase project** credentials (check `.env.local`)
- **Financial data APIs**: Yahoo Finance, FRED (Federal Reserve)

**Security:**
- Environment variables in `.env.local`
- Never commit secrets
- Supabase RLS policies protect user data

## Skill Routing (When to invoke skills)

- Bugs/errors/500s → `investigate`
- Ship/deploy/PR → `ship`
- QA testing → `qa`
- Code review → `review`
- Weekly retro → `retro`
- Design polish → `design-review`
- Architecture review → `plan-eng-review`

## Known Gotchas

1. **TypeScript path alias** requires `@/*` imports (not relative paths)
2. **Next.js 16** breaking changes - always check `node_modules/next/dist/docs/`
3. **Tailwind v4** syntax differs from v3
4. **React 19** has new hooks and patterns
5. **Financial calculations** require specific package versions (mathjs, docx, xlsx)
6. **API routes** handle heavy computation (may timeout)
7. **Supabase migrations** must run in order

## Stack Summary

- Next.js 16.2.1 (App Router) + React 19.2.4
- TypeScript 5 (strict mode, ES2017 target)
- Tailwind CSS v4 + shadcn/ui v4 + CVA
- Vitest + React Testing Library + jsdom
- Supabase (auth + database + migrations)
- Yahoo Finance, FRED APIs for market data
- Financial math libraries (mathjs, black-scholes)
- ESLint 9 (flat config only)

---
*Auto-generated guidance based on repository configuration. Update as project evolves.*