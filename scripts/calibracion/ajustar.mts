/**
 * La curva que corrige al clasificador.
 *
 * Une las tres piezas que ya están en la base: qué peldaño da el modelo
 * (`severity_llm_replay`), qué hizo el precio después (`severity_event_moves`) y
 * qué peldaño merecía el hecho (`severity_events`). De ahí sale una tabla de
 * traducción `severidad_llm -> severidad_final`, por tema, que el motor puede
 * aplicar sin volver a llamar a nadie.
 *
 * El criterio de «movimiento material» no es una opinión: es el umbral por
 * activo a partir del cual una posición cubierta se comporta distinto. Se mide
 * sobre el **extremo** de la ventana de cinco sesiones, no sobre el cierre,
 * porque lo que importa es si hubo susto en algún momento —igual que en
 * `medir.mts` y en `src/lib/pulso/labels.ts`.
 *
 * La curva se fuerza monótona: un peldaño más alto del LLM nunca puede acabar
 * dando un peldaño final más bajo. Sin esa garantía, un hueco del corpus —una
 * severidad con dos eventos, los dos tranquilos— invertiría el orden y el
 * sistema avisaría más fuerte de lo pequeño que de lo grande.
 *
 * Solo escribe `severity_calibration`. No toca el corpus ni el replay.
 *
 * ⚠️ SESGO DE SELECCIÓN, LEER ANTES DE APLICAR LA CURVA.
 * El corpus está hecho de eventos elegidos **por haber sido importantes**, así
 * que casi todos movieron el precio y P(movimiento) sale altísima en todos los
 * peldaños. El resultado es una curva que sube la severidad en vez de bajarla:
 * exactamente lo contrario del problema que se quería corregir. No es un error
 * de este script —mide bien lo que se le da— sino del conjunto que se le da.
 * Para que la curva sirva, el corpus necesita también los eventos anodinos que
 * llenan un día normal y que no movieron nada. Hasta entonces estas filas son
 * un registro de lo medido, no una tabla lista para producción.
 *
 * Uso:
 *   npm run calibracion:ajustar                 # usa el replay más reciente
 *   npm run calibracion:ajustar -- v2-precio    # usa esa versión del prompt
 */
import {
  isotonizarProbabilidad,
  huboMovimiento,
  liftSobreBase,
  peldanoDesdeProbabilidad,
  VENTANA_JUICIO,
} from '@/lib/alertas/calibracion'
import { createAdminClient } from '@/lib/supabase/admin'

interface FilaEvento { id: number; tema: string; severidad: number; tramo: string }
interface FilaMov { evento_id: number; ticker: string; ventana: number; extremo: number | null }
interface FilaReplay { evento_id: number | null; severidad_llm: number | null }

async function main(): Promise<void> {
  const admin = createAdminClient()
  const pedida = process.argv[2]

  const { data: replayData, error: errorReplay } = await admin
    .from('severity_llm_replay')
    .select('evento_id, severidad_llm, prompt_version, created_at')
    .order('created_at', { ascending: false })
    .limit(2000)
  if (errorReplay) throw new Error(`severity_llm_replay: ${errorReplay.message}`)

  const todas = (replayData ?? []) as unknown as Array<FilaReplay & { prompt_version: string }>
  if (!todas.length) throw new Error('no hay ningún replay: ejecuta antes "npm run calibracion:replay"')

  const version = pedida ?? todas[0].prompt_version
  const replay = todas.filter((f) => f.prompt_version === version)
  if (!replay.length) throw new Error(`no hay replay con la versión "${version}"`)

  const { data: eventosData, error: errorEventos } = await admin
    .from('severity_events')
    .select('id, tema, severidad, tramo')
  if (errorEventos) throw new Error(`severity_events: ${errorEventos.message}`)
  const eventos = new Map(
    ((eventosData ?? []) as unknown as FilaEvento[]).map((e) => [e.id, e]),
  )

  const { data: movsData, error: errorMovs } = await admin
    .from('severity_event_moves')
    .select('evento_id, ticker, ventana, extremo')
    .eq('ventana', VENTANA_JUICIO)
  if (errorMovs) throw new Error(`severity_event_moves: ${errorMovs.message}`)

  const movsPorEvento = new Map<number, FilaMov[]>()
  for (const m of (movsData ?? []) as unknown as FilaMov[]) {
    movsPorEvento.set(m.evento_id, [...(movsPorEvento.get(m.evento_id) ?? []), m])
  }

  // La línea base: qué hace el precio en una fecha sin hecho detrás. Sin ella
  // P(movimiento) no se puede interpretar, porque no se sabe contra qué compara.
  const placebo = [...eventos.values()].filter((e) => e.tramo === 'placebo')
  const placeboMovidos = placebo.filter((e) => huboMovimiento(movsPorEvento.get(e.id) ?? [])).length
  const base = placebo.length ? placeboMovidos / placebo.length : null

  console.log(`\nAJUSTE DE LA CURVA  ·  versión "${version}"  ·  ${replay.length} respuestas\n`)

  if (base == null) {
    console.log('⚠️  SIN GRUPO DE CONTROL. La curva saldrá sesgada: el corpus solo tiene')
    console.log('   eventos elegidos por haber sido importantes. Ejecuta antes')
    console.log('   "npm run calibracion:placebo".\n')
  } else {
    console.log(`Línea base: ${placeboMovidos} de ${placebo.length} fechas al azar movieron el precio (${(base * 100).toFixed(1)}%).`)
    console.log('La columna «lift» es lo que cada peldaño añade sobre eso, y es lo que decide el peldaño final.\n')
  }

  // Se agrupa por tema porque una escalada militar y una decisión de tasas no
  // mueven el precio igual, y el prompt tampoco es el mismo.
  const cubos = new Map<string, { movidos: number; total: number; merecida: number[] }>()

  for (const r of replay) {
    if (r.evento_id == null || r.severidad_llm == null) continue
    const evento = eventos.get(r.evento_id)
    // El placebo no se clasifica: no hay titular que juzgar. Solo es denominador.
    if (!evento || evento.tramo === 'placebo') continue

    const clave = `${evento.tema}|${r.severidad_llm}`
    const cubo = cubos.get(clave) ?? { movidos: 0, total: 0, merecida: [] }
    cubo.total++
    cubo.merecida.push(evento.severidad)
    if (huboMovimiento(movsPorEvento.get(r.evento_id) ?? [])) cubo.movidos++
    cubos.set(clave, cubo)
  }

  if (!cubos.size) throw new Error('ninguna respuesta del replay cruzó con el corpus medido')

  // `p` es la proporción observada y `pAjustada` la que sale de la regresión
  // isotónica. Se guardan las dos porque la tabla debe registrar el dato bruto
  // y la salida por pantalla tiene que enseñar dónde se fundieron dos peldaños.
  const porTema = new Map<string, Array<{ llm: number; p: number; n: number; merecidaMedia: number }>>()
  for (const [clave, cubo] of cubos) {
    const [tema, llmTexto] = clave.split('|')
    const merecidaMedia = cubo.merecida.reduce((a, b) => a + b, 0) / cubo.merecida.length
    porTema.set(tema, [
      ...(porTema.get(tema) ?? []),
      { llm: Number(llmTexto), p: cubo.movidos / cubo.total, n: cubo.total, merecidaMedia },
    ])
  }

  const filas: Array<Record<string, unknown>> = []

  for (const [tema, sinAjustar] of porTema) {
    const ajustados = isotonizarProbabilidad(sinAjustar)
    console.log(`TEMA ${tema}`)
    console.log('  llm   n   P(mov)   isot.   lift   merece   →  final')
    ajustados.forEach((punto, i) => {
      const bruta = sinAjustar.find((x) => x.llm === punto.llm)!.p
      // Sin control se cae a la probabilidad bruta, que es el comportamiento
      // viejo, y el aviso de arriba ya ha dicho que eso sale sesgado.
      const lift = base == null ? punto.p : liftSobreBase(punto.p, base)
      const final = peldanoDesdeProbabilidad(lift)
      // Un peldaño fundido con su vecino comparte probabilidad ajustada: se
      // marca porque es información —dice que el modelo no los distingue— y sin
      // la marca la tabla parece una coincidencia.
      const fundido = ajustados.some((otro, j) => j !== i && otro.p === punto.p)
      console.log(
        `   ${punto.llm}/5  ${String(punto.n).padStart(2)}    ${(bruta * 100).toFixed(0).padStart(3)}%`
        + `    ${(punto.p * 100).toFixed(0).padStart(3)}%${fundido ? '*' : ' '}`
        + `  ${(lift * 100).toFixed(0).padStart(3)}%`
        + `      ${punto.merecidaMedia.toFixed(1)}     →    ${final}/5`,
      )
      filas.push({
        tema,
        severidad_llm: punto.llm,
        p_movimiento: Number(bruta.toFixed(4)),
        // `severidad_final` sale del lift sobre la probabilidad ya isotonizada,
        // no de `p_movimiento`. La columna guarda la proporción bruta porque es
        // el dato observado; la corrección lleva descontada la línea base y el
        // promediado entre peldaños que se contradicen.
        severidad_final: final,
        n_eventos: punto.n,
        ajustada_at: new Date().toISOString(),
      })
    })
    if (ajustados.some((x, i) => ajustados.some((y, j) => j !== i && y.p === x.p))) {
      console.log('  * peldaños fundidos: se contradecían entre sí y comparten la media')
      console.log('    ponderada por casos. Que se fundan dice que el modelo no los distingue.')
    }
    console.log('')
  }

  const { error } = await admin
    .from('severity_calibration')
    .upsert(filas, { onConflict: 'tema,severidad_llm' })
  if (error) throw new Error(`severity_calibration: ${error.message}`)

  console.log(`Escritos ${filas.length} puntos de curva.`)
  console.log('Los peldaños del LLM que no aparecen se quedan sin corregir: el motor')
  console.log('los publica tal cual, que es lo correcto cuando no hay dato para juzgarlos.')

  // Se avisa aquí y no solo en el docstring porque quien ejecuta esto a los seis
  // meses lee la salida, no la cabecera del fichero.
  const sube = filas.filter((f) => (f.severidad_final as number) > (f.severidad_llm as number)).length
  if (sube > filas.length / 2) {
    console.log('')
    console.log('⚠️  La curva SUBE la severidad en la mayoría de los peldaños.')
    console.log('   Es el sesgo de selección del corpus: solo contiene eventos que')
    console.log('   fueron importantes, así que casi todos movieron el precio. Faltan')
    console.log('   los días anodinos. NO apliques esta curva en producción todavía.')
  }

  // Una línea base tan alta significa que el criterio de movimiento está
  // saturado: si en un día cualquiera casi siempre pasa algo, «pasó algo» no
  // distingue eventos. No es un problema del corpus sino del umbral.
  if (base != null && base >= 0.70) {
    console.log('')
    console.log(`⚠️  LÍNEA BASE DEL ${(base * 100).toFixed(0)}%: el criterio de movimiento está saturado.`)
    console.log('   Con ocho activos y la regla «basta que uno supere su umbral», casi')
    console.log('   cualquier semana del mercado cuenta como movimiento. Mientras la base')
    console.log('   siga así de alta, el lift es casi binario y la curva no es fiable.')
    console.log('   Se corrige subiendo los umbrales o exigiendo varios activos a la vez.')
  }

  // Con dos o tres casos por peldaño, P(movimiento) solo puede valer 0, 50 o
  // 100: la curva describe el sorteo, no el fenómeno.
  const flacos = filas.filter((f) => (f.n_eventos as number) < 5).length
  if (flacos) {
    console.log('')
    console.log(`⚠️  ${flacos} de ${filas.length} peldaños tienen menos de 5 casos.`)
    console.log('   Con esa muestra la proporción solo puede dar unos pocos valores y la')
    console.log('   curva describe el sorteo más que el fenómeno. Hace falta más corpus.')
  }
  console.log('')
}

main().catch((e) => {
  console.error(`error: ${(e as Error).message}`)
  process.exit(1)
})
