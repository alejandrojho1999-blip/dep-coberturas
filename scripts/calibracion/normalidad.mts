/**
 * Cómo es un día normal, y a qué distancia queda del umbral de un evento.
 *
 * La línea base dice que el 25% de las fechas al azar «mueven el precio». Es la
 * cifra que da sentido a la curva, pero por sí sola no explica nada: no dice
 * cuánto se mueve un activo cuando no pasa nada, ni cuál de los ocho es el que
 * produce ese 25%. Sin eso no se puede saber si un umbral está bien puesto o si
 * hay un activo saltando por su cuenta.
 *
 * Este script enseña la distribución de la que sale ese 25%, activo por activo,
 * y la pone al lado de la de los hechos curados. Las dos columnas que importan:
 *
 *  - **umbral / mediana**: cuántas veces el día corriente hay que multiplicar
 *    para llegar al umbral. Cuanto más alto, más raro es que salte por azar.
 *  - **cruces**: veces que el activo superó su umbral SIN que hubiera hecho
 *    detrás. Un activo con muchos cruces aquí está metiendo ruido en el
 *    veredicto, porque `huboMovimiento` basta con que uno cruce.
 *
 * Solo lee. No escribe en la base: el perfil es derivado de
 * `severity_event_moves`, que ya está cargado, y recalcularlo es instantáneo.
 * La ficha de `/alertas/backtesting` enseña esto mismo con los mismos datos.
 *
 * Uso:
 *   npm run calibracion:normalidad
 */
import {
  ETIQUETA_TICKER,
  perfilNormalidad,
  type EventoMedido,
} from '@/lib/alertas/backtesting'
import { VENTANA_JUICIO } from '@/lib/alertas/calibracion'
import { createAdminClient } from '@/lib/supabase/admin'

interface FilaEvento {
  fecha: string
  titulo: string
  tramo: string
  tema: string
  clase: string
  severidad: number
  nota: string | null
  severity_event_moves: Array<{
    ticker: string
    ventana: number
    retorno: number | null
    extremo: number | null
  }>
}

const pct = (v: number | null, decimales = 1) =>
  v == null ? '—' : `${(v * 100).toFixed(decimales)}%`

async function main(): Promise<void> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('severity_events')
    .select('fecha, titulo, tramo, tema, clase, severidad, nota, severity_event_moves(ticker, ventana, retorno, extremo)')
    .order('fecha', { ascending: true })
  if (error) throw new Error(`severity_events: ${error.message}`)

  const eventos: EventoMedido[] = ((data ?? []) as unknown as FilaEvento[]).map((f) => ({
    fecha: f.fecha,
    titulo: f.titulo,
    tramo: f.tramo,
    tema: f.tema,
    clase: f.clase,
    severidad: f.severidad,
    nota: f.nota,
    movimientos: (f.severity_event_moves ?? []).map((m) => ({
      ticker: m.ticker,
      ventana: m.ventana,
      retorno: m.retorno,
      extremo: m.extremo,
    })),
  }))

  const perfil = perfilNormalidad(eventos)
  if (!perfil.some((p) => p.n)) {
    throw new Error('no hay grupo de control cargado: ejecuta antes "npm run calibracion:placebo"')
  }

  console.log(`\nEL DÍA NORMAL, ACTIVO POR ACTIVO  ·  ventana de ${VENTANA_JUICIO} sesiones`)
  console.log('Desplazamiento máximo dentro de la ventana. En el VIX solo cuenta la subida.\n')

  console.log('                    ─────── fechas al azar ───────   ─── hechos curados ───')
  console.log('  activo      umbral  mediana    p90     max    cruza   mediana    cruza   separación')
  for (const p of perfil) {
    const etiqueta = (ETIQUETA_TICKER[p.ticker] ?? p.ticker).padEnd(9)
    const tasa = (cruces: number, n: number) => (n ? `${cruces}/${n}` : '—').padStart(7)
    console.log(
      `  ${etiqueta} ${pct(p.umbral, 0).padStart(6)}`
      + ` ${pct(p.p50).padStart(8)}`
      + ` ${pct(p.p90).padStart(7)}`
      + ` ${pct(p.max).padStart(7)}`
      + `  ${tasa(p.cruces, p.n)}`
      + ` ${pct(p.p50Curados).padStart(9)}`
      + `  ${tasa(p.crucesCurados, p.nCurados)}`
      + `   ${p.separacion == null ? '—' : `${p.separacion >= 0 ? '+' : ''}${(p.separacion * 100).toFixed(0)} pts`}`,
    )
  }
  console.log('')
  console.log('«separación» = cuánto más cruza el umbral con noticia que sin ella. Es la')
  console.log('columna que dice si el activo sirve: cerca de cero, solo añade ruido.')
  console.log('«umbral/mediana»:')
  console.log('  ' + perfil
    .map((p) => `${ETIQUETA_TICKER[p.ticker] ?? p.ticker} ${p.vecesLaMediana == null ? '—' : `×${p.vecesLaMediana.toFixed(1)}`}`)
    .join(' · '))

  // Lo que de verdad se busca aquí: quién produce la línea base. Si un solo
  // activo aporta la mayoría de los cruces, el veredicto depende de él.
  const totalCruces = perfil.reduce((a, p) => a + p.cruces, 0)
  console.log('')
  if (totalCruces) {
    console.log('QUIÉN PRODUCE LA LÍNEA BASE')
    for (const p of perfil.filter((x) => x.cruces)) {
      const cuota = p.cruces / totalCruces
      console.log(
        `  ${(ETIQUETA_TICKER[p.ticker] ?? p.ticker).padEnd(9)}`
        + ` ${String(p.cruces).padStart(2)} de ${totalCruces} cruces`
        + `  (${(cuota * 100).toFixed(0)}%)`,
      )
    }
  } else {
    console.log('Ningún activo cruzó su umbral en el grupo de control.')
  }

  // Se compara en tasa, no en cuenta: los dos grupos tienen tamaños distintos y
  // contar cruces a secas haría parecer ruidoso al que más fechas tiene.
  const flojos = perfil.filter((p) => p.separacion != null && p.separacion < 0.10 && p.n >= 20)
  if (flojos.length) {
    console.log('')
    console.log('⚠️  ACTIVOS QUE APENAS DISTINGUEN UNA NOTICIA DE UN MARTES CUALQUIERA:')
    for (const p of flojos) {
      console.log(
        `   ${(ETIQUETA_TICKER[p.ticker] ?? p.ticker).padEnd(9)}`
        + ` cruza el ${((p.cruces / p.n) * 100).toFixed(0)}% de las fechas al azar`
        + ` y el ${((p.crucesCurados / p.nCurados) * 100).toFixed(0)}% de los hechos`
        + `  (separación ${((p.separacion as number) * 100).toFixed(0)} pts).`,
      )
    }
    console.log('   Como `huboMovimiento` basta con que UNO cruce, un activo así arrastra')
    console.log('   el veredicto de todo el corpus sin aportar información.')
  }

  console.log('')
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
