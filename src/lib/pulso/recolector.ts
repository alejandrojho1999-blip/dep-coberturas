/**
 * Recolección del pulso: las seis fuentes a la vez.
 *
 * `allSettled` y no `all` a propósito. Cada recolector ya devuelve sus errores
 * como datos y no lanza, pero un fallo inesperado en uno no puede llevarse por
 * delante la lectura de los otros cinco: un día con cinco fuentes es un día
 * peor, no un día perdido.
 *
 * `fuentesVivas` viaja con el resultado porque el modelo necesita saberlo. Una
 * probabilidad calculada con media cobertura tiene que poder marcarse como
 * floja en vez de presentarse igual que las demás.
 */

import { recolectarHn } from '@/lib/pulso/hn'
import { recolectarMastodon } from '@/lib/pulso/mastodon'
import { recolectarNoticias } from '@/lib/pulso/news'
import { recolectarTrends } from '@/lib/pulso/trends'
import { recolectarWikipedia } from '@/lib/pulso/wikipedia'
import { recolectarYoutube } from '@/lib/pulso/youtube'
import { LOTE_VACIO, unirLotes, type FuentePulso, type LotePulso } from '@/lib/pulso/tipos'

export interface ResultadoPulso extends LotePulso {
  fuentesVivas: FuentePulso[]
}

const RECOLECTORES: ReadonlyArray<[FuentePulso, () => Promise<LotePulso>]> = [
  ['trends', recolectarTrends],
  ['wikipedia', recolectarWikipedia],
  ['hn', recolectarHn],
  ['mastodon', recolectarMastodon],
  ['youtube', recolectarYoutube],
  ['news', recolectarNoticias],
]

export async function recolectarPulso(): Promise<ResultadoPulso> {
  const resultados = await Promise.allSettled(RECOLECTORES.map(([, fn]) => fn()))

  const lotes: LotePulso[] = []
  const fuentesVivas: FuentePulso[] = []

  resultados.forEach((resultado, i) => {
    const [fuente] = RECOLECTORES[i]
    if (resultado.status === 'rejected') {
      lotes.push({ ...LOTE_VACIO, errores: [`${fuente}: ${String(resultado.reason)}`] })
      return
    }
    lotes.push(resultado.value)
    // Viva es la que trajo algo, no la que respondió: un feed que devuelve un
    // documento vacío no está aportando cobertura aunque conteste 200.
    if (resultado.value.observaciones.length || resultado.value.documentos.length) {
      fuentesVivas.push(fuente)
    }
  })

  return { ...unirLotes(lotes), fuentesVivas }
}
