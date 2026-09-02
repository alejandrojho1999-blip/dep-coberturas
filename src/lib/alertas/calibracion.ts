/**
 * Las reglas con las que se corrige la severidad del clasificador.
 *
 * Viven aquí y no en `scripts/calibracion/` porque son dos cosas a la vez: lo
 * que el script de ajuste usa para construir la curva, y lo que el motor usará
 * para aplicarla. Si estuvieran en el script, el umbral con el que se ajusta y
 * el umbral con el que se publica podrían divergir sin que nadie se enterara.
 *
 * El problema que resuelven: el prompt puntuaba gravedad humana en vez de efecto
 * en el precio, y repartía 4 y 5 al 60,9% de las señales. Un aviso que grita
 * siempre no avisa de nada.
 */

/**
 * Cuánto tiene que moverse cada activo para que la cobertura lo note.
 *
 * No son iguales porque los activos no lo son: un 3% en el oro es un día
 * histórico y en Bitcoin es un martes cualquiera. Las proporciones entre ellos
 * salen de la desviación diaria típica de cada uno.
 *
 * **Duplicados el 2026-09-02, con el grupo de control delante.** Los valores
 * viejos eran la mitad de estos y estaban saturados: en una fecha elegida al
 * azar, alguno de los ocho activos superaba su umbral el 85% de las veces, y
 * los eventos del corpus lo hacían el 82%. Es decir, una invasión movía el
 * mercado *menos* que un martes cualquiera. Con estos valores la separación
 * pasa a ser de 30% contra 59%.
 *
 * El fallo no estaba en ningún activo suelto —el más ruidoso, el Nasdaq, se
 * disparaba el 50% de los días al azar— sino en combinar ocho activos con la
 * regla «basta que uno», que es una prueba múltiple sin corregir: con ocho
 * intentos, que ninguno acierte es improbable. Duplicar el listón lo compensa
 * sin renunciar a la regla, que sigue teniendo sentido: un evento que solo
 * dispara el VIX es un evento del que hay que avisar.
 *
 * Aviso para quien los vuelva a tocar: la cifra se eligió comparando siete
 * criterios sobre los mismos 60 días de control y 27 eventos, así que parte de
 * su ventaja es sobreajuste. Tres de los siete quedaron empatados dentro del
 * ruido. Con más corpus, esto se revisa.
 */
export const UMBRAL_MATERIAL: Record<string, number> = {
  'GC=F': 0.06,
  'SI=F': 0.10,
  'BTC-USD': 0.16,
  'CL=F': 0.12,
  'NQ=F': 0.06,
  'ES=F': 0.05,
  '^VIX': 0.40,
  'DX-Y.NYB': 0.03,
}

/** La ventana sobre la que se juzga si un evento movió el mercado. */
export const VENTANA_JUICIO = 5

export interface MovimientoMedido {
  ticker: string
  /**
   * Mayor desplazamiento absoluto dentro de la ventana. Se juzga por el extremo
   * y no por el cierre porque lo que importa es si hubo susto en algún momento,
   * no si el viernes ya se había deshecho.
   */
  extremo: number | null
}

/**
 * Activos en los que solo cuenta la subida, no la bajada.
 *
 * El VIX es un índice de miedo: que suba un 30% es un susto y que baje un 30% es
 * el mercado calmándose. Medirlo en valor absoluto daba «hubo movimiento» en la
 * incursión de Kursk (06-08-2024), donde el VIX **cayó** un 51%. Para el oro o
 * el S&P el valor absoluto sí es lo correcto: da igual la dirección, lo que
 * importa es que la posición cubierta se comporta distinto.
 */
const SOLO_AL_ALZA = new Set(['^VIX'])

/**
 * ¿Se movió algo de verdad tras este evento?
 *
 * Basta con que **un** activo supere su umbral: un evento que dispara el VIX sin
 * tocar el oro sigue siendo un evento del que había que avisar. Un `extremo`
 * nulo es «no se sabe» —el activo no cotizaba esa fecha— y nunca cuenta como
 * movimiento.
 */
export function huboMovimiento(movimientos: readonly MovimientoMedido[]): boolean {
  return movimientos.some((m) => {
    const umbral = UMBRAL_MATERIAL[m.ticker]
    if (umbral == null || m.extremo == null) return false
    return SOLO_AL_ALZA.has(m.ticker) ? m.extremo >= umbral : Math.abs(m.extremo) >= umbral
  })
}

/**
 * De probabilidad observada a peldaño publicado.
 *
 * Los cortes reparten el 1-5 sobre la probabilidad de que el precio se moviera
 * de verdad. Son deliberadamente exigentes arriba: un 5 debe querer decir «esto
 * casi siempre mueve el mercado», no «esto suena grave».
 *
 * Úsese solo con una probabilidad ya normalizada por la línea base
 * (`liftSobreBase`). En bruto no significa nada: si en un día cualquiera algo se
 * mueve el 55% de las veces, un peldaño con el 60% no distingue nada y aquí
 * saldría un 4.
 */
export function peldanoDesdeProbabilidad(p: number): number {
  if (p >= 0.80) return 5
  if (p >= 0.60) return 4
  if (p >= 0.40) return 3
  if (p >= 0.20) return 2
  return 1
}

/**
 * Cuánto se separa un peldaño de lo que hace el mercado por sí solo.
 *
 * Devuelve la probabilidad reescalada al tramo que queda por encima de la línea
 * base: 0 cuando el peldaño no distingue nada del ruido de fondo, 1 cuando
 * mueve siempre. Es lo que convierte «el 86% de estos eventos movió el precio»
 * —que suena a mucho y puede no ser nada— en una cifra con sentido.
 *
 *   base 0,55 · p 0,60  ->  0,11   apenas distingue
 *   base 0,55 · p 0,90  ->  0,78   distingue de verdad
 *
 * Por debajo de la base el resultado es 0: un peldaño que acierta menos que el
 * azar no es informativo al revés, es simplemente inútil.
 */
export function liftSobreBase(p: number, base: number): number {
  if (base >= 1) return 0
  return Math.max(0, (p - base) / (1 - base))
}

/**
 * Impone que la curva no baje al subir el peldaño del LLM.
 *
 * Recorre de menor a mayor arrastrando el máximo visto. Con 27 eventos hay
 * peldaños con dos o tres casos, y ahí manda el ruido: esto es lo que impide que
 * un peldaño flaco invierta el orden y el sistema acabe avisando más fuerte de
 * lo pequeño que de lo grande.
 *
 * Devuelve una copia ordenada; no toca la entrada.
 */
export function forzarMonotonia<T extends { llm: number; final: number }>(puntos: readonly T[]): T[] {
  const ordenados = [...puntos].sort((a, b) => a.llm - b.llm)
  let maximo = 0
  return ordenados.map((punto) => {
    const final = Math.max(punto.final, maximo)
    maximo = final
    return { ...punto, final }
  })
}

export interface PuntoCurva {
  tema: string
  severidadLlm: number
  severidadFinal: number
}

/**
 * Traduce el peldaño del modelo al peldaño que se publica.
 *
 * Sin punto de curva para ese tema y peldaño, devuelve el original **sin
 * tocarlo**. Es lo correcto: la curva se construyó con 27 eventos y hay
 * combinaciones que no aparecen ni una vez. Inventar una corrección donde no hay
 * dato sería peor que no corregir.
 */
export function aplicarCurva(
  severidadLlm: number,
  tema: string,
  curva: readonly PuntoCurva[],
): number {
  const punto = curva.find((p) => p.tema === tema && p.severidadLlm === severidadLlm)
  return punto?.severidadFinal ?? severidadLlm
}

export interface RespuestaReplay {
  eventoId: number | null
  titular: string
  /** Nulo cuando el modelo dijo que el titular no era de su dominio. */
  severidadLlm: number | null
}

export interface ResumenReplay {
  /** Titulares que el prompt sacó de su dominio: avisos que nunca se enviarían. */
  descartados: string[]
  juzgados: number
  /** Cuántos de los juzgados salieron en 4 o 5, que es el vicio a corregir. */
  altos: number
  /**
   * Distancia media entre el peldaño del modelo y el que puso el analista.
   * Nula si no hay ni un evento que ambos hayan juzgado.
   */
  errorMedio: number | null
}

/**
 * Las cifras con las que se juzga una tanda del replay.
 *
 * Existe para que comparar dos versiones del prompt sea una resta y no una
 * lectura por encima de veintisiete líneas: así se llegó a repartir 4 y 5 al
 * 60,9% de las señales.
 */
export function resumirReplay(
  respuestas: readonly RespuestaReplay[],
  merecidaPorEvento: ReadonlyMap<number, number>,
): ResumenReplay {
  const descartados: string[] = []
  const errores: number[] = []
  let altos = 0

  for (const r of respuestas) {
    if (r.severidadLlm == null) {
      descartados.push(r.titular)
      continue
    }
    if (r.severidadLlm >= 4) altos++
    const merecida = r.eventoId == null ? undefined : merecidaPorEvento.get(r.eventoId)
    if (merecida != null) errores.push(Math.abs(r.severidadLlm - merecida))
  }

  return {
    descartados,
    juzgados: respuestas.length - descartados.length,
    altos,
    errorMedio: errores.length ? errores.reduce((a, b) => a + b, 0) / errores.length : null,
  }
}
