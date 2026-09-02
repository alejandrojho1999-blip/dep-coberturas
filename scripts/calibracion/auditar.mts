/**
 * Qué severidades ha estado repartiendo el clasificador.
 *
 * Es el paso cero de la recalibración: antes de cambiar el prompt hay que poder
 * decir con números en qué medida exagera. Lee `alert_signals`, agrupa por
 * severidad y tipo, y saca los titulares de los peldaños altos para poder
 * juzgarlos uno a uno.
 *
 * Solo lee. No escribe nada ni envía nada.
 */
import { createAdminClient } from '@/lib/supabase/admin'

interface Fila {
  tipo: string
  severidad: number
  titular: string
  fuente: string | null
  created_at: string
  motivo_llm?: string | null
}

function barra(n: number, total: number): string {
  const ancho = total > 0 ? Math.round((n / total) * 40) : 0
  return '█'.repeat(ancho) || '·'
}

async function main(): Promise<void> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('alert_signals')
    .select('tipo, severidad, titular, fuente, created_at, payload')
    .order('created_at', { ascending: false })
    .limit(2000)

  if (error) throw new Error(`alert_signals: ${error.message}`)

  const filas = (data ?? []) as unknown as Array<Fila & { payload?: Record<string, unknown> }>
  if (!filas.length) {
    console.log('No hay ninguna señal registrada todavía.')
    return
  }

  console.log(`\nSEÑALES REGISTRADAS: ${filas.length}`)
  console.log(`Desde ${filas.at(-1)!.created_at.slice(0, 16)} hasta ${filas[0].created_at.slice(0, 16)}\n`)

  console.log('DISTRIBUCIÓN DE SEVERIDAD')
  const porSeveridad = new Map<number, Fila[]>()
  for (const f of filas) porSeveridad.set(f.severidad, [...(porSeveridad.get(f.severidad) ?? []), f])

  for (let s = 5; s >= 1; s--) {
    const n = porSeveridad.get(s)?.length ?? 0
    const pct = ((n / filas.length) * 100).toFixed(1)
    console.log(`  ${s}/5  ${String(n).padStart(4)}  ${pct.padStart(5)}%  ${barra(n, filas.length)}`)
  }

  const altas = filas.filter((f) => f.severidad >= 4)
  console.log(`\n  Severidad >= 4: ${altas.length} de ${filas.length} (${((altas.length / filas.length) * 100).toFixed(1)}%)`)

  console.log('\nPOR TIPO')
  const porTipo = new Map<string, number[]>()
  for (const f of filas) porTipo.set(f.tipo, [...(porTipo.get(f.tipo) ?? []), f.severidad])
  for (const [tipo, sevs] of porTipo) {
    const media = sevs.reduce((a, b) => a + b, 0) / sevs.length
    console.log(`  ${tipo.padEnd(12)} n=${String(sevs.length).padStart(4)}  media=${media.toFixed(2)}`)
  }

  console.log('\nTITULARES CON SEVERIDAD >= 4 (los que hay que juzgar a mano)')
  for (const f of altas.slice(0, 40)) {
    console.log(`\n  [${f.severidad}/5] ${f.created_at.slice(0, 16)} · ${f.fuente ?? 'sin fuente'}`)
    console.log(`  ${f.titular.slice(0, 160)}`)
    const motivo = f.payload?.motivoLlm
    if (typeof motivo === 'string' && motivo) console.log(`  → ${motivo.slice(0, 160)}`)
  }

  console.log('')
}

main().catch((e) => {
  console.error(`error: ${(e as Error).message}`)
  process.exit(1)
})
