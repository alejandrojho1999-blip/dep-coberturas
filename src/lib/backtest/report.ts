/**
 * Informe en Markdown del backtest.
 *
 * El destinatario es un inversor, no un desarrollador: cada tabla va con la
 * pregunta que responde, y la sección de limitaciones es obligatoria — es lo
 * que justifica la compra de datos point-in-time de pago.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

function pct(x: number | null | undefined, dec = 2): string {
  return x == null || !Number.isFinite(x) ? '—' : `${(x * 100).toFixed(dec)} %`
}

function num(x: number | null | undefined, dec = 2): string {
  return x == null || !Number.isFinite(x) ? '—' : x.toFixed(dec)
}

function filaMetricas(nombre: string, m: any, opts: { esIndice?: boolean } = {}): string {
  // Un índice no se compara consigo mismo: su IR y su alfa no significan nada
  // en esta tabla, aunque el objeto los traiga calculados contra la cartera.
  const ir = opts.esIndice ? '—' : num(m.informationRatio)
  const alfa = opts.esIndice ? '—' : pct(m.alphaAnual)
  return `| ${nombre} | ${pct(m.retornoTotal)} | ${pct(m.cagr)} | ${num(m.sharpe)} | ${pct(m.maxDrawdown)} | ${ir} | ${alfa} | ${m.nOperaciones ?? '—'} | ${pct(m.hitRate, 1)} |`
}

/** La cabecera nombra el benchmark real: no siempre es el S&P 500. */
function cabecera(bench: string): string {
  return `| Escenario | Retorno total | CAGR | Sharpe | Max DD | IR vs ${bench} | Alfa anual | Ops. | Aciertos |\n` +
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|'
}

export function escribirInforme(r: any): string {
  const s = r.muestra
  const ve = r.ventajaEstadistica
  const tc = r.testDeControl

  const L: string[] = []

  L.push(`# Backtest del agente ${r.agente}`)
  L.push('')
  L.push(`Generado el ${new Date(r.generado).toISOString().slice(0, 10)} · universo \`${r.universo}\``)
  L.push('')
  if (r.capasDescripcion) {
    L.push(`**Variante evaluada: ${r.capasDescripcion}.**`)
    L.push('')
  }
  L.push('## Qué se ha medido')
  L.push('')
  L.push('Se replican los pasos reproducibles de la cascada del agente sobre un panel')
  L.push('point-in-time reconstruido con Yahoo Finance:')
  L.push('')
  const activa = (c: string) => r.capas == null || r.capas.includes(c)
  const marca = (texto: string, dentro: boolean) => dentro ? texto : `~~${texto}~~ — **desactivada en esta variante**`
  L.push(`1. ${marca('**Screener Lynch** — los 6 criterios con los umbrales de producción.', activa('lynch'))}`)
  L.push(`2. ${marca('**Proyección a 30 sesiones** — regresión lineal + EWMA, umbral +2 %.', activa('tecnico'))}`)
  L.push(`3. ${marca('**Momentum** — RSI-14, MACD y volumen; pasa con 2 de 3.', activa('tecnico'))}`)
  L.push('4. ~~Confirmación por LLM~~ — **no reproducible históricamente**, queda fuera.')
  L.push('')
  L.push('La venta replica la regla de producción: `failCount >= 2` de 3, con un tope de')
  L.push('permanencia. Una capa desactivada no puede sumar fallos, así que la variante')
  L.push('sin capas técnicas vende solo cuando el ticker deja de pasar el screener.')
  L.push('')

  L.push('## Muestra')
  L.push('')
  L.push('| Concepto | Valor |')
  L.push('|---|---:|')
  L.push(`| Ventana | ${s.desde} → ${s.hasta} |`)
  L.push(`| Rebalanceos mensuales | ${s.nRebalanceos} |`)
  L.push(`| Tickers del universo declarado | ${s.tickersDeclarados} |`)
  L.push(`| Tickers con datos utilizables | ${s.tickersConDatos} |`)
  L.push(`| Tickers que ya no cotizan | ${s.tickersSinPrecios} (${num(s.sesgoSupervivenciaPct, 1)} %) |`)
  L.push(`| Ejercicios anuales devueltos por Yahoo (mediana) | ${s.medianaEjerciciosAnuales} |`)
  if (s.medianaEjerciciosConDatos != null) {
    L.push(`| **Ejercicios con \`netIncome\` de verdad** | **${s.medianaEjerciciosConDatos}** |`)
  }
  if (s.mesesInicialesEnLiquidez) {
    L.push(`| Meses iniciales sin posiciones | ${s.mesesInicialesEnLiquidez} |`)
  }
  L.push(`| Retardo de publicación aplicado | ${r.parametros.reportingLagDias} días |`)
  L.push(`| Coste de transacción | ${r.parametros.costeBps} pb ida y vuelta |`)
  L.push('')

  L.push('## Resultado principal')
  L.push('')
  L.push(cabecera(r.benchmark.ticker))
  L.push(filaMetricas(`Agente ${r.agente}`, r.base))
  L.push(filaMetricas(`Benchmark ${r.benchmark.ticker}`, r.benchmark, { esIndice: true }))
  if (r.mercadoAmplio) L.push(filaMetricas(`Mercado amplio ${r.mercadoAmplio.ticker}`, r.mercadoAmplio, { esIndice: true }))
  L.push('')
  if (r.mercadoAmplio) {
    L.push(`> **Por qué ${r.benchmark.ticker} y no ${r.mercadoAmplio.ticker}.** Medir una cartera de small caps contra el`)
    L.push('> S&P 500 la compara con otra clase de activo. Si el segmento entero rinde por')
    L.push('> debajo del índice grande, un buen selector de small caps sale igualmente')
    L.push(`> "negativo". \`${r.benchmark.ticker}\` replica el S&P 600, de donde sale la mayor parte del`)
    L.push('> universo, y es contra quien hay que juzgar la selección. La fila del mercado')
    L.push('> amplio queda como referencia de coste de oportunidad: dice si convenía estar')
    L.push('> en este segmento, que es una decisión distinta de qué comprar dentro de él.')
    L.push('')
    const vs = r.mercadoAmplio
    L.push(`Frente a \`${vs.ticker}\` el retorno activo medio mensual es ${pct(vs.retornoActivoMedio)} ` +
      `(t-stat ${num(vs.contraste?.tStat)}), con alfa anual ${pct(vs.alphaAnual)} e IR ${num(vs.informationRatio)}.`)
    L.push('')
  }

  L.push('## 1 · ¿Hay ventaja estadística?')
  L.push('')
  L.push('Contraste sobre el retorno activo mensual (cartera − benchmark).')
  L.push('')
  L.push('| Contraste | Valor | Lectura |')
  L.push('|---|---:|---|')
  L.push(`| Retorno activo medio mensual | ${pct(ve.contrasteRetornoActivo.media)} | |`)
  L.push(`| t-stat (Newey-West, lag 3) | ${num(ve.contrasteRetornoActivo.tStat)} | ${veredictoT(ve.contrasteRetornoActivo.tStat)} |`)
  L.push(`| p-valor asintótico | ${num(ve.contrasteRetornoActivo.pValor, 4)} | |`)
  L.push(`| p-valor bootstrap de bloques | ${num(ve.bootstrapBloques.pValor, 4)} | ${veredictoP(ve.bootstrapBloques.pValor)} |`)
  if (ve.deflatedSharpe) {
    L.push(`| Sharpe esperado solo por azar | ${num(ve.deflatedSharpe.sharpeEsperadoPorAzar)} | con ${ve.nConfiguracionesProbadas} configuraciones probadas |`)
    L.push(`| **Deflated Sharpe Ratio** | ${num(ve.deflatedSharpe.probabilidad, 4)} | ${veredictoDSR(ve.deflatedSharpe.probabilidad)} |`)
  }
  L.push('')
  L.push('> El Deflated Sharpe corrige por haber probado varias configuraciones: sin él,')
  L.push('> la mejor de N estrategias sin señal parece rentable por pura selección.')
  L.push('')

  L.push('## 2 · Test de control: ¿selecciona el filtro o subió el mercado?')
  L.push('')
  L.push(`Se generan ${tc.nCarteras} carteras aleatorias del mismo universo, con el mismo`)
  L.push('número de posiciones en cada fecha y **emparejadas por sector y decil de')
  L.push('capitalización**. Si el filtro no aporta nada, la cartera real debería caer')
  L.push('cerca del percentil 50.')
  L.push('')
  L.push('| Medida | Valor |')
  L.push('|---|---:|')
  L.push(`| CAGR de la cartera del agente | ${pct(tc.cagrBase)} |`)
  L.push(`| CAGR mediano de las carteras de control | ${pct(tc.cagrControlMediano)} |`)
  L.push(`| **Percentil de la cartera del agente** | ${num(tc.percentilDeLaCarteraReal, 1)} |`)
  L.push('')
  L.push(veredictoControl(tc.percentilDeLaCarteraReal))
  L.push('')

  L.push('## 3 · Atribución: ¿qué criterio aporta el alfa?')
  L.push('')
  L.push('### Por exigencia del screener (solo capa Lynch, sin filtros técnicos)')
  L.push('')
  L.push(cabecera(r.benchmark.ticker))
  for (const [k, v] of Object.entries(r.atribucion.porScore)) L.push(filaMetricas(k, v))
  L.push('')
  if (Object.keys(r.atribucion.leaveOneOut).length) {
    L.push('### Quitando un criterio cada vez')
    L.push('')
    L.push('Si el resultado **mejora** al quitar un criterio, ese criterio está restando.')
    L.push('')
    L.push(cabecera(r.benchmark.ticker))
    for (const [k, v] of Object.entries(r.atribucion.leaveOneOut)) L.push(filaMetricas(k, v))
    L.push('')
  }
  L.push('### Por capa de la cascada')
  L.push('')
  L.push(cabecera(r.benchmark.ticker))
  for (const [k, v] of Object.entries(r.atribucion.porCapa)) L.push(filaMetricas(k, v))
  L.push('')

  L.push('## 4 · Robustez')
  L.push('')
  L.push(cabecera(r.benchmark.ticker))
  for (const [k, v] of Object.entries(r.robustez)) {
    if (k === 'subperiodos' || k === 'pruebaLookAhead') continue
    L.push(filaMetricas(k.replace(/_/g, ' '), v))
  }
  L.push('')
  L.push('### Subperiodos')
  L.push('')
  L.push('| Tramo | Meses | Cartera | Benchmark | Activo medio |')
  L.push('|---|---:|---:|---:|---:|')
  const tramosConDatos = r.robustez.subperiodos.filter((t: any) => t.retornoActivoMedio != null)
  for (const t of tramosConDatos) {
    L.push(`| ${t.nombre} | ${t.nPeriodos} | ${pct(t.retornoAcumulado)} | ${pct(t.retornoAcumuladoBenchmark)} | ${pct(t.retornoActivoMedio)} |`)
  }
  if (!tramosConDatos.length) L.push('| _(la ventana no da para partirla en tramos)_ | | | | |')
  L.push('')
  L.push('### Comprobación de look-ahead')
  L.push('')
  const pl = r.robustez.pruebaLookAhead
  L.push(`Repitiendo el backtest con retardo de publicación 0 (es decir, usando informes`)
  L.push(`antes de que fueran públicos) el Sharpe pasa de **${num(pl.sharpeConLag)}** a **${num(pl.sharpeSinLag)}**.`)
  L.push(pl.lagEfectivo
    ? 'Sube, como debe: el retardo de 90 días está actuando y el resultado principal no usa información futura.'
    : '**No sube**: revisar la aplicación del retardo antes de dar por bueno el resultado.')
  L.push('')

  if (r.sensibilidad?.barridoUmbrales?.length) {
    L.push('## 5 · ¿Conviene aflojar o apretar los filtros?')
    L.push('')
    L.push('Hay **dos ejes distintos** y conviene no confundirlos.')
    L.push('')
    L.push('### Eje A — los umbrales (qué de barata y de sana tiene que estar la empresa)')
    L.push('')
    L.push('| Umbrales | CAGR | Sharpe | IR vs SPY | Alfa anual | Ops. | Aciertos | Tramos ganados |')
    L.push('|---|---:|---:|---:|---:|---:|---:|---:|')
    for (const v of r.sensibilidad.barridoUmbrales) {
      L.push(`| ${v.etiqueta} | ${pct(v.cagr)} | ${num(v.sharpe)} | ${num(v.informationRatio)} | ${pct(v.alphaAnual)} | ${v.nOperaciones} | ${pct(v.hitRate, 1)} | ${tramosGanados(v.subperiodos)} |`)
    }
    L.push('')
    L.push('### Eje B — el corte de score (cuántos de los 6 criterios hay que cumplir)')
    L.push('')
    L.push('| Corte | CAGR | Sharpe | IR vs SPY | Alfa anual | Ops. | Aciertos | Tramos ganados |')
    L.push('|---|---:|---:|---:|---:|---:|---:|---:|')
    for (const v of r.sensibilidad.barridoCorte) {
      L.push(`| score ≥ ${v.corteScore} | ${pct(v.cagr)} | ${num(v.sharpe)} | ${num(v.informationRatio)} | ${pct(v.alphaAnual)} | ${v.nOperaciones} | ${pct(v.hitRate, 1)} | ${tramosGanados(v.subperiodos)} |`)
    }
    L.push('')
    L.push('> **Cómo leerlo.** Bajar el corte de score no es "seleccionar mejor": es')
    L.push('> seleccionar menos. Con el corte al mínimo la cartera tiene cientos de')
    L.push('> posiciones y se parece al índice, así que su CAGR se acerca al del índice')
    L.push('> mientras su Information Ratio se acerca a cero. Eso no es alfa, es beta.')
    L.push('> La columna que distingue una cosa de otra es **IR vs SPY**, no el CAGR.')
    L.push('')
    L.push('> **La columna "tramos ganados"** cuenta en cuántos de los subperiodos la')
    L.push('> configuración batió al benchmark. Una regla que solo gana en un tramo de')
    L.push('> tres no es una regla: es una racha.')
    L.push('')
  }

  if (r.paridadConElScreenerEnVivo) {
    const pz = r.paridadConElScreenerEnVivo
    L.push('## 6 · Calibración contra el screener en vivo')
    L.push('')
    L.push('El panel reconstruye los ratios a partir del último ejercicio **anual**')
    L.push('publicado; el screener en producción los lee **TTM** de Yahoo. Esta tabla mide')
    L.push('cuánto se parecen hoy, criterio a criterio, sobre los mismos tickers.')
    L.push('')
    L.push('| Criterio | Coincidencia |')
    L.push('|---|---:|')
    for (const [c, v] of Object.entries(pz.acuerdoPorCriterio as Record<string, number | null>)) {
      L.push(`| \`${c}\` | ${pct(v, 1)} |`)
    }
    L.push('')
    L.push(`Selección en vivo: ${pz.seleccionEnVivo.length} tickers · reconstruida: ${pz.seleccionDelPanel.length} · en ambas: ` +
      `${pz.seleccionEnVivo.filter((t: string) => pz.seleccionDelPanel.includes(t)).length} (Jaccard ${num(pz.jaccard, 2)}).`)
    L.push('')
    L.push('> El criterio con peor coincidencia marca dónde duele más la falta de datos')
    L.push('> point-in-time: es el que más ruido mete en todo lo anterior.')
    L.push('')
  }

  L.push('## Limitaciones')
  L.push('')
  L.push('Esto no es un backtest de calidad institucional, y hay que decirlo antes de que')
  L.push('lo diga otro:')
  L.push('')
  L.push(`1. **La ventana real es de ${s.nRebalanceos} meses, y ese es el problema de fondo.**`)
  L.push(`   Yahoo devuelve ${s.medianaEjerciciosAnuales} ejercicios anuales por ticker pero **el más antiguo viene`)
  L.push(`   siempre sin \`netIncome\`**, así que hay ${s.medianaEjerciciosConDatos ?? '4'} con datos. El criterio de crecimiento`)
  L.push('   necesita dos ejercicios, de modo que el primer mes en que el screener puede')
  L.push(`   seleccionar algo es ${s.desde}. Todo lo anterior sería la cartera en liquidez, no`)
  L.push('   una estrategia. Con menos de tres años y un solo régimen de mercado, ningún')
  L.push('   contraste de esta página tiene potencia para separar señal de ruido: los')
  L.push('   p-valores altos significan "no se sabe", no "no funciona".')
  L.push(`2. **Sesgo de supervivencia.** Los universos están escritos a mano con la`)
  L.push(`   composición de hoy. ${s.tickersSinPrecios} tickers (${num(s.sesgoSupervivenciaPct, 1)} %) ya no cotizan y se caen`)
  L.push('   silenciosamente. Además, los renombramientos (FISV→FI) resuelven solos en Yahoo,')
  L.push('   así que esa cifra es una **cota inferior**, no la magnitud real del sesgo.')
  L.push('3. **Dos criterios son proxies.** `forwardPE` y `PEG` necesitan histórico de')
  L.push('   consenso de analistas, que Yahoo no da. Se sustituyen por el crecimiento ya')
  L.push('   publicado. La fila `criterios limpios sin proxy` de la tabla de robustez mide')
  L.push('   cuánto depende el resultado de esa sustitución.')
  L.push('4. **La capa de IA no está validada.** El paso 4 (`conviction >= 7` de un LLM) no')
  L.push('   se puede reconstruir hacia atrás. Todo lo anterior mide la cascada *sin* ella.')
  L.push('5. **Fundamentales anuales, no trimestrales.** Entre dos informes anuales las')
  L.push('   features de un ticker no cambian, así que los rebalanceos mensuales rotan por')
  L.push('   señal técnica y precio, no por fundamentales nuevos.')
  L.push('')
  L.push('## Qué resolvería un proveedor point-in-time de pago')
  L.push('')
  L.push('| Limitación | Qué aporta Sharadar SF1 / FMP |')
  L.push('|---|---|')
  L.push('| 4-5 años de fundamentales | 20+ años con fecha de presentación real, sin necesidad de retardo estimado |')
  L.push('| Sesgo de supervivencia | Tickers delisted, adquiridos y quebrados incluidos |')
  L.push('| Constituyentes de índice de hoy | Composición histórica del S&P 500 / 600 por fecha |')
  L.push('| `forwardPE` y `PEG` por proxy | Histórico de estimaciones de consenso |')
  L.push('')
  L.push('Con eso la ventana pasa de un puñado de años a dos décadas y los contrastes de')
  L.push('esta misma página dejan de estar limitados por el tamaño de muestra.')
  L.push('')

  return L.join('\n')
}

/** Cuántos subperiodos batieron al benchmark, de los que tienen datos. */
function tramosGanados(subperiodos: any[]): string {
  const conDatos = (subperiodos ?? []).filter(t => t.retornoActivoMedio != null)
  if (!conDatos.length) return '—'
  return `${conDatos.filter(t => t.retornoActivoMedio > 0).length} de ${conDatos.length}`
}

function veredictoT(t: number | null): string {
  if (t == null) return '—'
  const a = Math.abs(t)
  if (a >= 3) return 'fuerte'
  if (a >= 2) return 'significativo al 5 %'
  if (a >= 1.65) return 'marginal'
  return 'no significativo'
}

function veredictoP(p: number | null): string {
  if (p == null) return '—'
  if (p <= 0.01) return 'muy significativo'
  if (p <= 0.05) return 'significativo'
  if (p <= 0.10) return 'marginal'
  return 'compatible con el azar'
}

function veredictoDSR(p: number | null): string {
  if (p == null) return '—'
  if (p >= 0.95) return 'el Sharpe sobrevive a la corrección por multiple testing'
  if (p >= 0.80) return 'indicio, no prueba'
  return 'no distinguible de la suerte'
}

function veredictoControl(percentil: number): string {
  if (!Number.isFinite(percentil)) return ''
  if (percentil >= 95) return '**El filtro selecciona.** La cartera del agente bate a 95 de cada 100 carteras aleatorias comparables.'
  if (percentil >= 80) return 'Indicio favorable, pero dentro de lo que produce el azar con cierta frecuencia.'
  if (percentil <= 20) return '**Señal de alarma:** el filtro va por detrás de la selección aleatoria comparable.'
  return '**El filtro no demuestra aportar nada:** la cartera cae en la zona central de lo que dan carteras aleatorias del mismo perfil. El rendimiento observado es atribuible al mercado y al perfil sector/tamaño, no a la selección.'
}
