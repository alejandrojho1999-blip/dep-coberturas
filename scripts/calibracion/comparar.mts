/**
 * ¿Mejoró el prompt, o solo movió el problema de sitio?
 *
 * Enfrenta dos versiones del replay sobre el mismo corpus y enseña, evento a
 * evento, qué cambió. Sin esto, un cambio de prompt se juzga leyendo por encima
 * veintisiete líneas y decidiendo que «se ve mejor», que es exactamente como se
 * llegó a repartir 4 y 5 al 60,9% de las señales.
 *
 * Las dos cifras que importan:
 *  - **Descartados**: eventos del corpus que el prompt dice no ser de su dominio.
 *    Cada uno es un aviso que nunca se habría enviado.
 *  - **Error medio**: distancia entre el peldaño que da el modelo y el que el
 *    analista puso en el corpus, contando solo los que ambos juzgaron.
 *
 * Solo lee.
 *
 * Uso:
 *   npm run calibracion:comparar -- replay-2026-09-02 v2-relevancia
 */
import { resumirReplay } from '@/lib/alertas/calibracion'
import { createAdminClient } from '@/lib/supabase/admin'

interface FilaReplay {
  evento_id: number | null
  prompt_version: string
  titular: string
  severidad_llm: number | null
}

/** De la fila de la base a lo que espera `resumirReplay`. */
function comoRespuestas(filas: FilaReplay[]) {
  return filas.map((f) => ({
    eventoId: f.evento_id,
    titular: f.titular,
    severidadLlm: f.severidad_llm,
  }))
}

async function main(): Promise<void> {
  const [antes, despues] = process.argv.slice(2)
  if (!antes || !despues) {
    throw new Error('uso: npm run calibracion:comparar -- <version-antes> <version-despues>')
  }

  const admin = createAdminClient()

  const { data: eventosData, error: errorEventos } = await admin
    .from('severity_events')
    .select('id, severidad')
  if (errorEventos) throw new Error(`severity_events: ${errorEventos.message}`)
  const merecida = new Map(
    ((eventosData ?? []) as unknown as Array<{ id: number; severidad: number }>)
      .map((e) => [e.id, e.severidad]),
  )

  const { data, error } = await admin
    .from('severity_llm_replay')
    .select('evento_id, prompt_version, titular, severidad_llm')
    .in('prompt_version', [antes, despues])
  if (error) throw new Error(`severity_llm_replay: ${error.message}`)

  const filas = (data ?? []) as unknown as FilaReplay[]
  const deAntes = filas.filter((f) => f.prompt_version === antes)
  const deDespues = filas.filter((f) => f.prompt_version === despues)

  if (!deAntes.length) throw new Error(`no hay replay con la versión "${antes}"`)
  if (!deDespues.length) throw new Error(`no hay replay con la versión "${despues}"`)

  const a = resumirReplay(comoRespuestas(deAntes), merecida)
  const b = resumirReplay(comoRespuestas(deDespues), merecida)

  console.log(`\nCOMPARACIÓN  "${antes}"  →  "${despues}"\n`)
  console.log('                        antes   después')
  console.log(`  descartados            ${String(a.descartados.length).padStart(3)}      ${String(b.descartados.length).padStart(3)}`)
  console.log(`  juzgados               ${String(a.juzgados).padStart(3)}      ${String(b.juzgados).padStart(3)}`)
  console.log(`  con severidad >= 4     ${String(a.altos).padStart(3)}      ${String(b.altos).padStart(3)}`)
  console.log(
    `  error medio            ${(a.errorMedio?.toFixed(2) ?? ' n/d').padStart(4)}     ${(b.errorMedio?.toFixed(2) ?? ' n/d').padStart(4)}`,
  )

  // Un evento recuperado es uno que antes se descartaba y ahora se juzga: es la
  // medida directa de si los agujeros del filtro se taparon.
  const antesDescartados = new Set(a.descartados)
  const despuesDescartados = new Set(b.descartados)
  const recuperados = [...antesDescartados].filter((t) => !despuesDescartados.has(t))
  const perdidos = [...despuesDescartados].filter((t) => !antesDescartados.has(t))

  if (recuperados.length) {
    console.log('\nRECUPERADOS (antes descartados, ahora se juzgan)')
    for (const t of recuperados) {
      const fila = deDespues.find((f) => f.titular === t)
      const m = fila?.evento_id == null ? null : merecida.get(fila.evento_id)
      console.log(`  + da ${fila?.severidad_llm}/5  merece ${m ?? '?'}/5   ${t.slice(0, 62)}`)
    }
  }

  if (perdidos.length) {
    console.log('\nPERDIDOS (antes se juzgaban, ahora se descartan)')
    for (const t of perdidos) console.log(`  - ${t.slice(0, 70)}`)
  }

  if (despuesDescartados.size) {
    console.log('\nSIGUEN DESCARTADOS')
    for (const t of despuesDescartados) console.log(`  · ${t.slice(0, 70)}`)
  }

  console.log('')
}

main().catch((e) => {
  console.error(`error: ${(e as Error).message}`)
  process.exit(1)
})
