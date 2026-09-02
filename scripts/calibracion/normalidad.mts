/**
 * Cómo es un día normal, y a qué distancia queda del umbral de un evento.
 *
 * La línea base dice qué proporción de las fechas al azar «mueven el precio». Es
 * la cifra que da sentido a la curva, pero por sí sola no explica nada: no dice
 * cuánto se mueve un activo cuando no pasa nada, ni cuál de ellos la produce.
 * Sin eso no se puede saber si un umbral está bien puesto o si hay un activo
 * saltando por su cuenta.
 *
 * Este script enseña la distribución de la que sale esa cifra, activo por
 * activo, y la pone al lado de la de los hechos curados. Las columnas que
 * importan:
 *
 *  - **umbral / mediana**: cuántas veces el día corriente hay que multiplicar
 *    para llegar al umbral. Cuanto más alto, más raro es que salte por azar.
 *  - **cruza**: veces que el activo superó su umbral sin hecho detrás, frente a
 *    veces que lo superó con uno.
 *  - **separación**: la diferencia entre esas dos tasas.
 *
 * ⚠️ **La separación no basta para decidir quitar un activo.** Como la regla es
 * «basta que uno cruce», lo que decide es la aportación marginal: cuánto cambia
 * el criterio COMPLETO al retirarlo. El oro separa poco por su cuenta (+9
 * puntos) y aun así quitarlo no cambia ni una fila, porque nunca cruza solo;
 * el Nasdaq separaba más (+15) y sí estropeaba el veredicto, porque sus cruces
 * eran los únicos de esas fechas. Para medirlo hay que comparar la separación
 * de la cesta con y sin el activo, y remuestrear para ver si la diferencia
 * aguanta. Así se excluyó el Nasdaq el 2026-09-03.
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

  console.log('                       ─────── fechas al azar ───────   ── hechos curados ──')
  console.log('  activo      umbral  mediana    p90     max    cruza   mediana    cruza   separación')
  for (const p of perfil) {
    const etiqueta = ((ETIQUETA_TICKER[p.ticker] ?? p.ticker) + (p.vota ? '' : ' *')).padEnd(9)
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
  const sinVoto = perfil.filter((p) => !p.vota)
  console.log('')
  if (sinVoto.length) {
    console.log(`(*) ${sinVoto.map((p) => ETIQUETA_TICKER[p.ticker] ?? p.ticker).join(', ')}`
      + ' se mide y se enseña pero NO cuenta para el veredicto.')
    console.log('    Ver ACTIVOS_SIN_VOTO en calibracion.ts para el porqué de cada uno.')
    console.log('')
  }
  console.log('«separación» = cuánto más cruza el umbral con noticia que sin ella. Dice si el')
  console.log('activo distingue, pero NO basta para decidir quitarlo: bajo la regla «basta que')
  console.log('uno cruce» lo que decide es la aportación marginal. El oro separa poco (+9 pts)')
  console.log('y aun así quitarlo no cambia ni una fila, porque nunca cruza solo.')
  console.log('«umbral/mediana»:')
  console.log('  ' + perfil
    .map((p) => `${ETIQUETA_TICKER[p.ticker] ?? p.ticker} ${p.vecesLaMediana == null ? '—' : `×${p.vecesLaMediana.toFixed(1)}`}`)
    .join(' · '))

  // Lo que de verdad se busca aquí: quién produce la línea base. Si un solo
  // activo aporta la mayoría de los cruces, el veredicto depende de él.
  const votantes = perfil.filter((p) => p.vota)
  const totalCruces = votantes.reduce((a, p) => a + p.cruces, 0)
  console.log('')
  if (totalCruces) {
    console.log('QUIÉN PRODUCE LA LÍNEA BASE')
    for (const p of votantes.filter((x) => x.cruces)) {
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
  const flojos = votantes.filter((p) => p.separacion != null && p.separacion < 0.10 && p.n >= 20)
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
    console.log('   Antes de quitar ninguno hay que medir su aportación marginal: un activo')
    console.log('   que nunca cruza solo no estropea nada aunque separe poco.')
  }

  console.log('')
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
