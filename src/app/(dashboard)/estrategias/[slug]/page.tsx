import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CATALOGO, fichaPorSlug } from '@/lib/estrategias/catalogo'
import { backtestDe, documentosDe } from '@/lib/estrategias/datos'
import { FichaEstrategia } from './_components/FichaEstrategia'

/** Las seis fichas se generan en build: el contenido no cambia entre peticiones. */
export function generateStaticParams() {
  return CATALOGO.map(f => ({ slug: f.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const ficha = fichaPorSlug(slug)
  if (!ficha) return { title: 'Estrategia no encontrada — SynerGy' }
  return {
    title: `${ficha.nombre} — Estrategias · SynerGy`,
    description: ficha.enUnaFrase,
  }
}

/** Lee el código de producción. Si falta, la ficha simplemente no lo muestra. */
async function leerCodigo(slug: string): Promise<string | null> {
  try {
    return await readFile(join(process.cwd(), 'public/estrategias/code', `${slug}.cs`), 'utf8')
  } catch {
    return null
  }
}

export default async function EstrategiaPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const ficha = fichaPorSlug(slug)
  if (!ficha) notFound()

  const [backtest, codigo, documentos] = await Promise.all([
    backtestDe(slug),
    leerCodigo(slug),
    documentosDe(slug),
  ])

  return (
    <FichaEstrategia
      ficha={ficha}
      backtest={backtest}
      codigo={codigo}
      documentos={documentos}
    />
  )
}
