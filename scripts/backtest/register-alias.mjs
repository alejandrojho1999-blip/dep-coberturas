/**
 * Hook de resolución para ejecutar los módulos TypeScript del backtest
 * directamente con `node --experimental-strip-types`.
 *
 * Next.js resuelve el alias `@/*` → `./src/*` vía tsconfig, pero Node no lee
 * tsconfig. Este hook lo replica y añade la extensión `.ts`/`.tsx` que Node
 * exige en ESM, de modo que `src/lib/backtest/*.ts` pueda seguir usando la
 * convención de imports del repo (AGENTS.md: siempre `@/*`, nunca relativos).
 *
 * Uso: ver los scripts `backtest:*` de package.json.
 */
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const SRC = path.join(ROOT, 'src')

const HOOK = `
import { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const SRC = ${JSON.stringify(SRC)}
const EXTS = ['.ts', '.tsx', '.mts', '.js', '.mjs']

function withExtension(absPath) {
  if (existsSync(absPath) && path.extname(absPath)) return absPath
  for (const ext of EXTS) {
    if (existsSync(absPath + ext)) return absPath + ext
  }
  for (const ext of EXTS) {
    const idx = path.join(absPath, 'index' + ext)
    if (existsSync(idx)) return idx
  }
  return null
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const resolved = withExtension(path.join(SRC, specifier.slice(2)))
    if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true }
  }
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const parent = context.parentURL
    if (parent?.startsWith('file:')) {
      const resolved = withExtension(path.resolve(path.dirname(fileURLToPath(parent)), specifier))
      if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true }
    }
  }
  return nextResolve(specifier, context)
}
`

register(`data:text/javascript,${encodeURIComponent(HOOK)}`, pathToFileURL(path.join(ROOT, '/')))
