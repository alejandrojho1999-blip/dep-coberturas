/**
 * Sube el corpus y sus mediciones a Supabase.
 *
 * El patrón oro vive en el repo (`eventos.ts`) porque ahí se revisa con el resto
 * del código, pero para cruzarlo con las señales reales tiene que estar en la
 * misma base. Este script hace ese puente: lee el corpus y el JSON que dejó
 * `medir.mts`, y los deja en `severity_events` y `severity_event_moves`.
 *
 * Es idempotente: reejecutarlo con datos nuevos actualiza las filas existentes
 * en vez de duplicarlas.
 *
 * Requiere la migración 025 aplicada.
 *
 * Uso:
 *   npm run calibracion:medir     # primero, deja movimientos.json
 *   npm run calibracion:cargar
 */
import { existsSync, readFileSync } from 'node:fs'

import { createAdminClient } from '@/lib/supabase/admin'

import type { EventoHistorico } from './eventos.ts'
import type { Movimiento } from './medir.mts'

const ENTRADA = 'scratchpad/calibracion/movimientos.json'

interface Medicion {
  evento: EventoHistorico
  movimientos: Movimiento[]
}

async function main(): Promise<void> {
  if (!existsSync(ENTRADA)) {
    throw new Error(`falta ${ENTRADA}: ejecuta antes "npm run calibracion:medir"`)
  }

  const medidos = JSON.parse(readFileSync(ENTRADA, 'utf8')) as Medicion[]
  const admin = createAdminClient()

  console.log(`\nCARGA DE ${medidos.length} EVENTOS`)

  let filasMovimiento = 0

  for (const { evento, movimientos } of medidos) {
    const { data, error } = await admin
      .from('severity_events')
      .upsert(
        {
          fecha: evento.fecha,
          tramo: evento.tramo,
          tema: evento.tema,
          clase: evento.clase,
          titulo: evento.titulo,
          severidad: evento.severidad,
          nota: evento.nota,
          verificado: evento.verificado,
        },
        { onConflict: 'fecha,titulo' },
      )
      .select('id')
      .single()

    if (error) throw new Error(`severity_events ${evento.fecha}: ${error.message}`)

    const eventoId = (data as { id: number }).id

    if (movimientos.length) {
      const { error: errorMov } = await admin.from('severity_event_moves').upsert(
        movimientos.map((m) => ({
          evento_id: eventoId,
          ticker: m.ticker,
          ventana: m.ventana,
          retorno: m.retorno,
          extremo: m.extremo,
          sesion_base: m.sesionBase,
        })),
        { onConflict: 'evento_id,ticker,ventana' },
      )
      if (errorMov) throw new Error(`severity_event_moves ${evento.fecha}: ${errorMov.message}`)
      filasMovimiento += movimientos.length
    }

    console.log(`  ${evento.fecha}  ${String(movimientos.length).padStart(3)} medidas  ${evento.titulo.slice(0, 60)}`)
  }

  console.log(`\nCargados ${medidos.length} eventos y ${filasMovimiento} mediciones.\n`)
}

main().catch((e) => {
  console.error(`error: ${(e as Error).message}`)
  process.exit(1)
})
