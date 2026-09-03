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
 * **El VIX baja del 40% al 25% el 2026-09-03.** Al 40% no aportaba nada: la
 * separación del criterio completo era la misma con él que sin él, +1 punto,
 * porque solo 5 de los 32 hechos del corpus llegaban a mover tanto el VIX. El
 * umbral estaba puesto para que cruzar fuera raro, sin comprobar que los
 * eventos de verdad cruzaran: la mediana del VIX en un hecho curado es del 17%
 * y su p75 del 34%, así que tres cuartas partes de los eventos se quedaban
 * cortos. Al 25% captura 11 de 32 y su aportación pasa de +1 a +7 puntos.
 *
 * El 25% no es el valor que más separa —eso sería el 12,5%, con 25 puntos— y
 * está elegido a propósito por dos razones. La primera es que el 12,5% sube la
 * línea base al 53%, que es volver a la saturación que estos umbrales
 * corrigieron: con un día cualquiera moviéndose la mitad de las veces, «pasó
 * algo» deja de distinguir. La segunda es que entre el 17,5% y el 27,5% la
 * separación se queda clavada en 16 puntos durante cinco pasos seguidos, y esa
 * meseta es la señal de que el valor no está ajustado al ruido de la muestra;
 * el pico del 12,5% dura dos pasos y tiene toda la pinta de serlo. Se coge el
 * centro de la meseta.
 *
 * Con el 25%, el VIX cae en el percentil 83 del día normal, en línea con
 * Bitcoin (p85) y los índices (p87). Honestidad sobre lo que esto prueba: la
 * mejora frente al 40% sale en el 83% de los remuestreos, pero su intervalo del
 * 90% es [-3, 16] y toca el cero. Lo que sí está fuera de duda es que el 40%
 * era peso muerto.
 *
 * **Los otros cinco umbrales se revisaron el mismo día y ninguno se movió.**
 * Buscar el mejor umbral de seis activos sobre una rejilla de once valores son
 * 66 pruebas sobre el mismo corpus, y eso encuentra mejoras aunque no haya nada
 * que encontrar. Para saber cuánto regala la búsqueda se barajó la etiqueta
 * hecho/control y se repitió el barrido entero 600 veces: por puro azar, la
 * mejor separación alcanzable es de 13 puntos de mediana y llega a 27 en el
 * percentil 95. Ese, y no el cero, es el listón. Solo el oro lo pasa
 * holgadamente (33 puntos reales, p=0,000). El resto se queda dentro del ruido:
 * plata p=0,092, Bitcoin p=0,128, WTI p=0,127, Nasdaq p=0,142, S&P p=0,183. El
 * VIX, medido con la misma vara a posteriori, da p=0,037 y aguanta.
 *
 * Quien quiera volver a barrer estos umbrales: hágalo con esta corrección
 * puesta. Sin ella, cualquiera de los cinco parecerá mejorable.
 *
 * Aviso para quien los vuelva a tocar: la cifra se eligió comparando siete
 * criterios sobre los mismos 60 días de control y 27 eventos, así que parte de
 * su ventaja es sobreajuste. Tres de los siete quedaron empatados dentro del
 * ruido. Con más corpus, esto se revisa.
 *
 * **El oro baja del 6% al 3,6% el 2026-09-03, y es el cambio más grande que ha
 * tenido esta tabla.** Al 6% el oro no solo no aportaba: *restaba*. La
 * separación del criterio completo era de 16 puntos con él y de 18 sin él,
 * porque a ese listón solo cruzaban 4 de los 32 hechos y las pocas fechas de
 * control que lo acompañaban pesaban más. Al 3,6% cruzan 12, la separación sube
 * a **32 puntos** y el oro pasa a ser **el activo más valioso de la cesta**
 * (+14 puntos de aportación marginal, por delante del VIX con +9).
 *
 * El 3,6% es el centro del tramo llano más largo del barrido: entre el 3,4% y
 * el 3,8%, en pasos del 0,1%, la separación se queda clavada en 32 puntos
 * durante cinco escalones seguidos. El pico absoluto está en el 2,9–3,3% con 33
 * puntos, un solo punto más, pero allí la línea base sube al 45–48% y se acerca
 * a la saturación que estos umbrales existen para evitar; en el 3,6% se queda en
 * el 43%. El remuestreo da **+15 puntos [4, 28]**, con el intervalo del 90%
 * estrictamente positivo, que es más de lo que pudo enseñar el VIX.
 *
 * Lo que entra al bajar el listón son seis hechos y solo dos fechas de control.
 * Los seis son creíbles uno por uno: la anexión de Crimea (+4,5%), los cables
 * del Báltico (+5,6%), el Balticconnector (+5,5%), el recorte de 50 pb de la
 * Fed (+3,8%), la doctrina nuclear rusa (+3,8%) y la incursión sobre Estonia
 * (+3,9%). Crimea es la comprobación que más tranquiliza: era el caso que el
 * informe citaba como «movió su mercado y el sistema dice que no».
 *
 * **Confirmación fuera de muestra del 3,6%, ese mismo día.** El umbral se
 * eligió con 32 hechos; horas después el corpus creció a 44 con doce hechos
 * anodinos que no existían cuando se tomó la decisión. Medido sobre ellos, el
 * 3,6% sigue ganando al 6% por **+10 puntos [2, 20]**, mejorando en el 98% de
 * los remuestreos, y el tramo llano sigue estando entre el 3,4% y el 3,8%. No
 * era un artefacto del corpus con el que se ajustó.
 *
 * **El dólar se revisó el 2026-09-03 y se queda en el 3%, por un motivo que no
 * es el que parecía.** El aviso decía que estaba inerte: percentil 100, cero
 * cruces en las 60 fechas de control y solo 2 de los 32 hechos, aportación
 * marginal de 0 puntos. Todo cierto. Lo que no era cierto es la conclusión que
 * se le presuponía —que el dólar no distingue—: ordenando hechos contra días
 * normales es **el activo que mejor separa de toda la cesta**, con un AUC de
 * 0,666 [0,560, 0,769], por encima del VIX (0,639) y del S&P (0,610).
 *
 * El problema no es el nivel del umbral, es que la señal del dólar no vive en
 * la cola. Su mediana en un hecho curado es del 1,29% y en un día de control del
 * 0,99%: la diferencia está en el centro de la distribución, no en el extremo.
 * Y esta regla es un OR —basta que uno cruce—, que solo sabe explotar activos
 * cuya señal esté en la cola. Bajar el umbral hasta donde el dólar tiene algo
 * que decir mete más días de control que hechos: al 2% añade 3 controles y 0
 * curados; al 1,5%, 6 controles y 2 curados; al 1%, 17 y 9. El único punto que
 * sale positivo es el 1,25% (10 y 7, +5 pts), y no aguanta el examen: la línea
 * base sube al 57% —peor saturación que el 53% que descartó al VIX en el
 * 12,5%—, su intervalo del 90% es [-9, 20] y el barrido fino en pasos del 0,05%
 * no enseña meseta ninguna sino una sierra (23, 20, 20, 25, 18 puntos entre el
 * 1,05% y el 1,25%). Es ruido de la muestra.
 *
 * Así que el 3% se queda: es un umbral que no hace nada, pero cualquier
 * alternativa hace daño. Lo que hay que apuntar para el futuro es que **el
 * dólar es el caso que enseña el límite de la regla del OR**. Si alguna vez se
 * sustituye por algo que cuente cuántos activos cruzan, o que puntúe la
 * magnitud en vez de contar cruces, el dólar es el primero que hay que volver a
 * mirar: es el que más información tiene y el que esta regla peor aprovecha.
 */
export const UMBRAL_MATERIAL: Record<string, number> = {
  // 6% -> 3,6% el 2026-09-03. Ver la nota de arriba.
  'GC=F': 0.036,
  'SI=F': 0.10,
  'BTC-USD': 0.16,
  'CL=F': 0.12,
  'NQ=F': 0.06,
  'ES=F': 0.05,
  // 40% -> 25% el 2026-09-03. Ver la nota de arriba.
  '^VIX': 0.25,
  // Revisado y confirmado en el 3% el 2026-09-03. Ver la nota de arriba.
  'DX-Y.NYB': 0.03,
}

/**
 * Los activos que se miden pero **no votan** en el veredicto.
 *
 * Ahora mismo no hay ninguno, y el conjunto vacío es el estado correcto. Se deja
 * el mecanismo porque la pregunta vuelve cada vez que crece el corpus, y sobre
 * todo porque la historia de por qué está vacío es la lección más cara que ha
 * dado esta calibración.
 *
 * **El Nasdaq se excluyó el 2026-09-03 y se readmitió el mismo día.** La prueba
 * parecía sólida: quitarlo subía la separación del criterio de 22 a 27 puntos,
 * la mejora salía en el 96% de los remuestreos, y había un motivo estructural
 * —correlaciona 0,82 con el S&P, o sea que es el mismo índice contado dos
 * veces—. Sus únicos cruces en solitario del grupo de control eran tres, y los
 * tres de 2002 y 2003.
 *
 * Esas tres fechas eran el problema, y no por el Nasdaq. El grupo de control se
 * muestreaba uniformemente desde 2001 mientras el corpus se concentra en los
 * 2020, así que el control tenía su mediana en 2010 y el corpus en 2022: se
 * estaba comparando un evento reciente contra un día normal de otra década. Al
 * emparejar el muestreo por época (ver `placebo.mts`), las fechas de las
 * puntocom desaparecieron del control y con ellas toda la ventaja de quitar el
 * Nasdaq: pasó de +5 puntos a **+0, en el 0% de los remuestreos**.
 *
 * La lección, para quien vuelva a mirar esta lista: **antes de culpar a un
 * activo, comprobar que el denominador es comparable.** Un control que no cubre
 * las mismas épocas que el corpus fabrica culpables.
 */
export const ACTIVOS_SIN_VOTO = new Set<string>()

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
 * El desplazamiento de un activo en la escala en la que se compara con su umbral.
 *
 * Existe para que la regla del VIX viva en un solo sitio. `huboMovimiento`
 * responde sí o no, pero para describir un día normal hace falta la magnitud, y
 * si cada uno la calculase por su cuenta acabarían discrepando en el único
 * activo donde el signo importa.
 */
export function magnitudComparable(ticker: string, extremo: number): number {
  return SOLO_AL_ALZA.has(ticker) ? extremo : Math.abs(extremo)
}

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
    if (ACTIVOS_SIN_VOTO.has(m.ticker)) return false
    return magnitudComparable(m.ticker, m.extremo) >= umbral
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
 * Impone que la curva no baje al subir el peldaño del LLM, promediando en vez
 * de arrastrar.
 *
 * La monotonía hace falta: sin ella, un peldaño flaco invierte el orden y el
 * sistema acaba avisando más fuerte de lo pequeño que de lo grande. La pregunta
 * es **cómo** se impone, y la respuesta anterior estaba mal.
 *
 * **Lo que se hacía hasta el 2026-09-03** era recorrer de menor a mayor
 * arrastrando el máximo visto, sobre el peldaño ya calculado. Eso convierte a
 * cualquier peldaño alto en un **suelo** para todos los de encima, sin importar
 * con cuántos casos se midió. Con `v8` el resultado fue una curva degenerada:
 * `fed_tesoro 2/5` (n=5) subió a 4 y arrastró a los tres peldaños restantes al
 * 4, incluido el `3/5`, que con n=6 tenía un lift medido del **0%**. El tema
 * entero publicaba un 4 dijera lo que dijera el modelo.
 *
 * **Lo que se hace ahora** es regresión isotónica por el método de los bloques
 * adyacentes (*pool adjacent violators*), **ponderada por el número de casos** y
 * aplicada a la probabilidad, no al peldaño. Donde dos peldaños contiguos se
 * contradicen, en vez de imponer el mayor se **funden en un bloque** y los dos
 * se quedan con la media ponderada. El peldaño con más casos manda; el de n=1
 * aporta lo que pesa.
 *
 * Sobre el mismo caso: `fed_tesoro 2/5` (n=5, 80%) y `3/5` (n=6, 17%) se funden
 * en un bloque del 45%, que está a la altura de la línea base y baja los dos a
 * 1; el `4/5` y el `5/5` quedan libres en 3 y 4. La curva vuelve a discriminar.
 *
 * Que dos peldaños se fundan **es información, no una pérdida**: dice que el
 * modelo no los distingue. En `fed_tesoro` el 2 y el 3 son la misma reunión de
 * la Fed contada con otras palabras, y la curva ahora lo refleja.
 *
 * Aplicarlo sobre la probabilidad y no sobre el peldaño hace innecesario un
 * segundo paso de monotonía: `liftSobreBase` y `peldanoDesdeProbabilidad` son
 * las dos crecientes, así que una entrada ordenada sale ordenada.
 *
 * Devuelve una copia ordenada por `llm`; no toca la entrada.
 */
export function isotonizarProbabilidad<T extends { llm: number; p: number; n: number }>(
  puntos: readonly T[],
): T[] {
  const ordenados = [...puntos].sort((a, b) => a.llm - b.llm)

  /** Cada bloque es un tramo contiguo que ya se ha fundido en una sola media. */
  const bloques: Array<{ suma: number; peso: number; desde: number; hasta: number }> = []

  ordenados.forEach((punto, i) => {
    // Un peso de 0 dejaría el bloque sin media definida; se cuenta como un caso.
    const peso = punto.n > 0 ? punto.n : 1
    bloques.push({ suma: punto.p * peso, peso, desde: i, hasta: i })

    // Mientras el bloque nuevo contradiga al anterior, se funden. Fundir puede
    // crear una contradicción con el de más atrás, de ahí el bucle.
    while (bloques.length >= 2) {
      const ultimo = bloques[bloques.length - 1]
      const previo = bloques[bloques.length - 2]
      if (previo.suma / previo.peso <= ultimo.suma / ultimo.peso) break
      bloques.splice(bloques.length - 2, 2, {
        suma: previo.suma + ultimo.suma,
        peso: previo.peso + ultimo.peso,
        desde: previo.desde,
        hasta: ultimo.hasta,
      })
    }
  })

  const salida = [...ordenados]
  for (const bloque of bloques) {
    const media = bloque.suma / bloque.peso
    for (let i = bloque.desde; i <= bloque.hasta; i++) salida[i] = { ...salida[i], p: media }
  }
  return salida
}

export interface PuntoCurva {
  tema: string
  severidadLlm: number
  severidadFinal: number
}

/**
 * Casos por debajo de los cuales un punto de curva no se aplica.
 *
 * Con menos de cinco eventos, `P(movimiento)` solo puede valer unos pocos
 * valores —con tres casos, 0, 33, 67 o 100— así que el peldaño que sale describe
 * el sorteo más que el fenómeno. Corregir con eso es peor que no corregir: mete
 * ruido con cara de medición.
 *
 * El número no es mágico ni está optimizado; es el mismo listón con el que
 * `ajustar.mts` lleva meses avisando por pantalla, y ponerlo aquí es hacer que
 * el aviso tenga consecuencias en vez de quedarse en la consola de quien
 * ejecuta el script.
 *
 * El filtro se aplica en `cargarCurva`, no aquí: los puntos flacos no llegan a
 * la curva, y `aplicarCurva` los trata como lo que son, peldaños sin dato. A
 * fecha de 2026-09-03 eso afecta a `guerra 3/5` (n=3), `guerra 5/5` (n=2) y
 * `fed_tesoro 4/5` (n=2).
 */
export const N_MINIMO_PARA_CORREGIR = 5

/**
 * Traduce el peldaño del modelo al peldaño que se publica.
 *
 * Dos reglas, y la segunda existe por un fallo que solo se vio al cablear esto
 * al motor el 2026-09-03.
 *
 * **Sin punto de curva, se publica el original sin tocarlo.** Es lo correcto:
 * hay combinaciones que el corpus no contiene, y los puntos medidos con menos
 * de `N_MINIMO_PARA_CORREGIR` casos se dejan fuera al cargar la curva. Inventar
 * una corrección donde no hay dato sería peor que no corregir.
 *
 * **Pero un peldaño sin dato no puede publicar más que uno superior que sí lo
 * tiene.** Al filtrar los peldaños flacos aparecía esta curva en `guerra`:
 * el 4/5 medido con ocho casos bajaba a 2 —y con el umbral de envío en 3 dejaba
 * de sonar el teléfono— mientras el 3/5, sin dato suficiente, se publicaba tal
 * cual y **sí** sonaba. O sea, el sistema avisaba de lo pequeño y callaba lo
 * grande: exactamente lo que la monotonía existe para impedir, colándose por la
 * puerta de atrás del filtro.
 *
 * Así que un peldaño sin corregir se topa con el mínimo de los peldaños
 * superiores que sí están medidos. Si el 4 vale 2, el 3 no puede valer más de 2.
 * En el otro sentido no hace falta tocar nada: `ajustar.mts` ya entrega la
 * curva isotonizada, y un peldaño sin dato por encima de otros corregidos no
 * rompe el orden.
 */
export function aplicarCurva(
  severidadLlm: number,
  tema: string,
  curva: readonly PuntoCurva[],
): number {
  const delTema = curva.filter((p) => p.tema === tema)

  const punto = delTema.find((p) => p.severidadLlm === severidadLlm)
  if (punto) return punto.severidadFinal

  const techo = delTema
    .filter((p) => p.severidadLlm > severidadLlm)
    .reduce((minimo, p) => Math.min(minimo, p.severidadFinal), Number.POSITIVE_INFINITY)

  return Math.min(severidadLlm, techo)
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
