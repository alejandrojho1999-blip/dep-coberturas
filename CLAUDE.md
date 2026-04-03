# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start dev server (Turbopack by default)
npm run build    # Production build (Turbopack by default)
npm start        # Start production server
npm run lint     # Run ESLint (flat config, eslint.config.mjs)
npx next typegen # Generate type helpers for async params/searchParams
```

## Stack

- **Next.js 16.2.1** — App Router, `src/app/` directory
- **React 19.2.4**
- **Tailwind CSS v4** — configured via `@import "tailwindcss"` and `@theme inline` (not the v3 `@tailwind` directives)
- **TypeScript 5** — strict mode, path alias `@/*` → `./src/*`
- **shadcn v4**
- **ESLint 9** — flat config only

## Next.js 16 Breaking Changes

**Always `await` dynamic APIs** — synchronous access is fully removed:
```ts
// cookies, headers, draftMode, params, searchParams are all async
const cookieStore = await cookies()
const { slug } = await params
```

Run `npx next typegen` to generate `PageProps`, `LayoutProps`, `RouteContext` type helpers.

**`middleware` renamed to `proxy`** — the old convention is deprecated.

**`experimental.turbopack` moved to top-level `turbopack`** in `next.config.ts`.

**Image generation functions** (`opengraph-image`, `twitter-image`, `icon`, `apple-icon`) — `params` and `id` are now `Promise`s; must be awaited.

**Sitemap `id`** — the `id` parameter in sitemap generating functions is now a `Promise<string>`.

## Reglas de calidad

- SIEMPRE verifica tu trabajo antes de darlo por terminado. Revisa que el código compila, que no hay errores de tipos, y que la lógica tiene sentido.
- Antes de implementar cualquier cambio, investiga el código existente para entender cómo funciona. No asumas — lee el código primero.
- NO implementes nada a menos que estés 100% seguro de que va a funcionar. Si tienes dudas, investiga más o pregúntame antes de proceder.

## Sistema de memoria

- Antes de terminar cualquier sesión de trabajo, guarda un resumen de lo que hiciste, lo que falta por hacer y cualquier decisión importante en un archivo .md dentro de la carpeta del proyecto (por ejemplo: PROGRESS.md o SESSION_NOTES.md).
- Al iniciar una nueva sesión, busca y lee estos archivos de memoria para entender dónde te quedaste y qué sigue.
- Organiza las notas por secciones: "Completado", "En progreso", "Pendiente" y "Decisiones tomadas".
- Actualiza estos archivos cada vez que completes un bloque significativo de trabajo.

