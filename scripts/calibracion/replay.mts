/**
 * Qué diría el prompt de hoy sobre los titulares de ayer.
 *
 * Es el paso que faltaba para poder calibrar. La auditoría dice que el
 * clasificador reparte 4 y 5 al 60,9% de las señales, pero eso solo describe el
 * problema: para corregirlo hace falta saber qué peldaño da el prompt a cada
 * evento del corpus, y cruzarlo con lo que el precio hizo de verdad después.
 *
 * El corpus lleva la severidad que cada evento **merecía** por efecto de precio,
 * puesta por un analista. Este script añade la que el modelo **da**. La
 * distancia entre las dos es la curva de corrección.
 *
 * Cada reejecución se etiqueta con `prompt_version`, para poder comparar dos
 * revisiones del prompt sin borrar la anterior.
 *
 * Cuesta llamadas al LLM: una por evento del corpus, 44 a fecha de 2026-09-03.
 * No es un cron.
 *
 * Uso:
 *   npm run calibracion:replay                    # etiqueta con la fecha de hoy
 *   npm run calibracion:replay -- v2-precio       # etiqueta a mano
 */
import { clasificarTitular } from '@/lib/alertas/clasificador'
import { createAdminClient } from '@/lib/supabase/admin'

import { EVENTOS, type EventoHistorico } from './eventos.ts'

const MODELO = process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-chat-v3-0324'

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * El evento del corpus, vestido de titular.
 *
 * `publicadoAt` es el mediodía UTC del día del suceso y el «ahora» que se le
 * presenta al modelo son tres horas después: dentro de la ventana de 48 horas
 * que el prompt exige, que es la única forma de que juzgue el hecho en vez de
 * descartarlo por viejo.
 */
function comoTitular(evento: EventoHistorico) {
  const publicado = new Date(`${evento.fecha}T12:00:00Z`)
  return {
    titular: {
      titulo: evento.titulo,
      fuente: 'corpus de calibración',
      url: `https://corpus.local/${evento.fecha}`,
      publicadoAt: publicado.toISOString(),
    },
    ahora: new Date(publicado.getTime() + 3 * 60 * 60 * 1000),
  }
}

async function main(): Promise<void> {
  const version = process.argv[2] ?? `replay-${new Date().toISOString().slice(0, 10)}`
  const admin = createAdminClient()

  console.log(`\nREEJECUCIÓN DEL CLASIFICADOR SOBRE ${EVENTOS.length} EVENTOS`)
  console.log(`Versión: ${version}   ·   Modelo: ${MODELO}\n`)

  const filas: Array<Record<string, unknown>> = []
  let fallidos = 0

  for (const evento of EVENTOS) {
    const { titular, ahora } = comoTitular(evento)

    // El id de la fila del corpus, para poder cruzar el replay con la medición
    // del precio sin repetir la fecha por todas partes.
    const { data: fila } = await admin
      .from('severity_events')
      .select('id')
      .eq('fecha', evento.fecha)
      .eq('titulo', evento.titulo)
      .maybeSingle()

    try {
      const c = await clasificarTitular(titular, evento.tema, ahora)

      // Un `relevante: false` no es un fallo: es el modelo diciendo que ese
      // titular no habría disparado aviso ninguno. Se guarda con severidad nula
      // para distinguirlo de un error de red, que no deja fila.
      const severidadLlm = c.relevante ? c.severidad : null

      filas.push({
        evento_id: (fila as { id: number } | null)?.id ?? null,
        prompt_version: version,
        modelo: MODELO,
        titular: evento.titulo,
        severidad_llm: severidadLlm,
        evento_key: c.eventoKey,
        motivo: c.motivo,
      })

      const dado = severidadLlm == null ? 'n/r' : `${severidadLlm}/5`
      const delta = severidadLlm == null ? '   ' : signo(severidadLlm - evento.severidad)
      console.log(
        `  ${evento.fecha}  merece ${evento.severidad}/5  ·  da ${dado.padEnd(3)} ${delta}`
        + `   ${evento.titulo.slice(0, 52)}`,
      )
    } catch (e) {
      fallidos++
      console.log(`  ${evento.fecha}  ERROR: ${(e as Error).message.slice(0, 70)}`)
    }

    // OpenRouter limita por ráfaga y esto no tiene ninguna prisa.
    await dormir(1200)
  }

  if (filas.length) {
    const { error } = await admin.from('severity_llm_replay').insert(filas)
    if (error) throw new Error(`severity_llm_replay: ${error.message}`)
  }

  console.log(`\nGuardadas ${filas.length} respuestas${fallidos ? `, ${fallidos} fallidas` : ''}.`)
  console.log(`Siguiente paso: npm run calibracion:ajustar -- ${version}\n`)
}

function signo(d: number): string {
  if (d === 0) return ' ='
  return d > 0 ? `+${d}` : `${d}`
}

main().catch((e) => {
  console.error(`error: ${(e as Error).message}`)
  process.exit(1)
})
