import type { FichaEstrategia } from './types'

/**
 * Contenido curado de las seis tesis de inversión.
 *
 * Todo lo que hay aquí sale de los documentos de
 * `Emporium/Trading Algoritmico/Estrategias individuales/` en Drive. Las cifras
 * calculables (neto, drawdown, curva, régimen) NO se guardan aquí: se derivan de
 * las operaciones en `scripts/build-estrategias.mjs`. Aquí vive solo lo que un
 * CSV no puede contener — el porqué, los criterios y lo que cada sistema no
 * cumple.
 *
 * La regla al escribir estas fichas es la misma que siguen las tesis: si un
 * dato incomoda, se publica igual. La sección `loQueNoCumple` no es opcional.
 */

export const CORTE_REGIMEN_ETIQUETA = 'julio de 2020'

/** Marco común a las seis. Se muestra una sola vez en el índice. */
export const MARCO_COMUN = {
  instrumento: 'MNQ (Micro E-mini Nasdaq-100)',
  validadoSobre: 'NQ 09-26',
  periodo: '1 de enero de 2015 – 14 de agosto de 2026',
  duracion: '11,6 años',
  contratos: '1 contrato por estrategia',
  costes: 'comisión NinjaTrader Brokerage y deslizamiento de 2 ticks',
  escalado: 'Las cifras se expresan en MNQ dividiendo NQ entre 10. La comisión no escala exactamente 1:10, de modo que el neto real en micros será algo inferior.',
  estado: 'Fase E — simulado, sin capital asignado',
  cuenta: 50_000,
} as const

export const CATALOGO: FichaEstrategia[] = [
  // ─────────────────────────── Overnight Drift ──────────────────────────
  {
    slug: 'overnight-drift',
    nombre: 'Overnight Drift',
    subtitulo: 'Cobrar la prima por sostener riesgo nocturno',
    enUnaFrase:
      'Compra el Nasdaq dos minutos antes del cierre y lo vende en la apertura del día siguiente, solo si el precio está por encima de la media de 200 sesiones.',
    estilo: 'Prima nocturna',
    instrumento: 'MNQ',
    grafico: '1 minuto',
    sesion: 'RTH',
    direccion: 'Solo largos',
    contratos: 1,
    desdeFaseE: '2026-08-11',
    comoOpera: [
      {
        etiqueta: 'Entrada',
        valor: 'A mercado, dos minutos antes del cierre de la sesión regular',
        nota: 'La hora de cierre no está codificada: el bot la aprende observando la última barra de las cinco sesiones anteriores, así los medios días se resuelven solos.',
      },
      {
        etiqueta: 'Filtro',
        valor: 'El cierre debe superar la media de los últimos 200 cierres de sesión',
        nota: 'Es el único filtro, y recorta el drawdown a la mitad.',
      },
      { etiqueta: 'Salida', valor: 'En la primera barra de la sesión siguiente' },
      { etiqueta: 'Stop', valor: 'Ninguno', nota: 'Y no por omisión: se probó con datos y empeora todo.' },
      { etiqueta: 'Objetivo', valor: 'Ninguno' },
      { etiqueta: 'Dirección', valor: 'Solo compras' },
    ],
    metricasTesis: {
      netoNQ: 244_197,
      drawdownNQ: -41_951,
      probability: 0.68,
      rCuadrado: 0.88,
    },
    aporteCartera: {
      netoSobreDrawdownSinElla: 17.45,
      coste: -4.34,
      ratioRegimen: '4,2×',
      tAnterior: 0.57,
      tPosterior: 2.44,
      correlaciones: [
        { con: 'Momentum de Apertura', media: 0.29, peoresDias: -0.72 },
        { con: 'RSI2 Reversion', media: -0.12, peoresDias: -0.67 },
        { con: 'ZigZag Breakout', media: 0.06, peoresDias: -0.38 },
        { con: 'IBS Reversion', media: -0.038, peoresDias: null },
      ],
      nota: 'Es la que más beneficio aporta al conjunto, un 27 % del total, pero también la tercera más cara de perder.',
    },
    loQueSostiene: [
      'Es la estrategia con más operaciones de la cartera: 2.076 en 11,6 años. La muestra grande hace que sus conclusiones tengan potencia estadística real.',
      'El filtro de tendencia demostró su valor en 2022: solo 15 operaciones en todo el año bajista, con una pérdida contenida en $4.756. Sin el filtro habría operado los 250 días.',
      'La ausencia de stop no es un descuido sino un resultado medido: se implementó una serie secundaria de un minuto en horario extendido, dedicada a vigilar el recorrido de madrugada, y el barrido salió perfectamente monótono — cuanto más apretado el stop, peor en todas las métricas.',
      'De las operaciones que el stop cortaba, una de cada seis habría acabado ganando. El movimiento nocturno del Nasdaq revierte con frecuencia.',
    ],
    loQueNoCumple: [
      'El edge es posterior a la pandemia. Los 5,5 años anteriores a julio de 2020 dan un t-stat de 0,61 sobre 903 operaciones: estadísticamente, nada. Hay evidencia directa de que no funcionaba en el régimen anterior.',
      'El riesgo de hueco nocturno no está acotado, ni puede estarlo. La posición vive entera fuera del horario del gráfico y está demostrado que ponerle protección empeora el conjunto. El único control es el tamaño.',
      'Siete de las doce peores noches del histórico son de 2024 en adelante. Parte es aritmética — el mismo porcentaje de caída son más dólares con el índice en 23.000 que en 4.300 — pero la cola que amenaza hoy es más gruesa que la del promedio histórico.',
      'La concentración es la de un sistema de colas: sin las 50 mejores operaciones el sistema es negativo.',
    ],
    riesgos: [
      { etiqueta: 'Peor noche histórica', valor: '-$1.993 en MNQ', nota: '-$19.931 en NQ, el 22 de junio de 2026.' },
      { etiqueta: 'Riesgo de hueco', valor: 'No acotado', nota: 'Un evento del 10 % nocturno produciría unos -$4.600 por contrato MNQ.' },
      { etiqueta: 'Dimensionamiento', valor: '1 contrato MNQ por cada $40.000 de cuenta', nota: 'Es el ÚNICO control de riesgo que funciona en esta estrategia.' },
      { etiqueta: 'Rollover', valor: 'Expuesto', nota: 'La posición se mantiene entre sesiones.' },
      { etiqueta: 'Revisión de tamaño', valor: 'Cada 6 meses', nota: 'El riesgo en dólares crece con el nivel del índice aunque el porcentaje sea el mismo.' },
    ],
    configProduccion: [
      { etiqueta: 'Instrumento y gráfico', valor: 'MNQ · 1 minuto · CME US Index Futures RTH' },
      { etiqueta: 'Gap de sesión', valor: '120 minutos' },
      { etiqueta: 'Minutos antes del cierre', valor: '2' },
      { etiqueta: 'Filtro de tendencia', valor: 'Activo · SMA de 200 cierres de sesión' },
      { etiqueta: 'Contratos', valor: '1 por cada $40.000 de cuenta' },
      { etiqueta: 'Stop / objetivo', valor: 'Ninguno' },
      { etiqueta: 'Dirección', valor: 'Solo compras' },
    ],
  },

  // ─────────────────────────── RSI2 Reversion ───────────────────────────
  {
    slug: 'rsi2-reversion',
    nombre: 'RSI2 Reversion',
    subtitulo: 'El mejor bot de la cartera y la pieza diversificadora que no lo era',
    enUnaFrase:
      'Compra retrocesos dentro de tendencias alcistas: entra cuando el RSI de tres días cae por debajo de 25 con el precio sobre su media de 200, y sale al primer cierre por encima de la media de tres días.',
    estilo: 'Reversión a la media',
    instrumento: 'MNQ',
    grafico: 'Diario',
    sesion: 'ETH',
    direccion: 'Solo largos',
    contratos: 1,
    desdeFaseE: '2026-08-11',
    comoOpera: [
      { etiqueta: 'Entrada', valor: 'RSI(3) < 25 con el cierre por encima de la SMA(200)' },
      { etiqueta: 'Salida', valor: 'Cuando el cierre supera la SMA(3)' },
      { etiqueta: 'Duración media', valor: '3,5 días' },
      { etiqueta: 'Stop', valor: 'Ninguno, y por diseño', nota: 'Descartado por tres pruebas independientes.' },
      { etiqueta: 'Frecuencia', valor: 'Unas 11 operaciones al año', nota: 'La muestra más pequeña de la cartera.' },
      { etiqueta: 'Dirección', valor: 'Solo compras' },
    ],
    metricasTesis: {
      netoNQ: 188_295,
      drawdownNQ: -20_407,
      probability: 0.04,
    },
    aporteCartera: {
      netoSobreDrawdownSinElla: 12.29,
      coste: -9.5,
      ratioRegimen: '∞',
      tAnterior: -0.11,
      tPosterior: 4.14,
      correlaciones: [{ con: 'Overnight Drift', media: -0.12, peoresDias: -0.67 }],
      nota: 'Es la pieza más cara de perder con diferencia: quitarla cuesta 9,5 puntos de Net/DD, casi el doble que la siguiente.',
    },
    loQueSostiene: [
      'Son las mejores métricas individuales de toda la cartera: el Net/DD más alto, la Probability más baja y el t-stat más elevado.',
      'Es el único estilo de reversión del conjunto. Los otros cinco compran fuerza; éste compra miedo, así que dispara en días distintos.',
      'La concentración es la más equilibrada de la cartera: la mejor operación vale solo el 8 % del beneficio, y quitando las veinte mejores el sistema sigue en positivo. En el ZigZag el top-10 llega al 96 %.',
      'Junto al ZigZag, es una de las dos únicas piezas con protección de cola real: en el 10 % de peores días del portafolio correlaciona -0,67 con el Overnight Drift.',
    ],
    loQueNoCumple: [
      'No diversifica el riesgo de régimen, en contra de lo que su propia documentación sostenía. Es el caso más extremo de la cartera: t-stat de -0,11 antes de julio de 2020 y de 4,14 después. Si la estrategia que compra miedo y las que compran fuerza dependen del mismo cambio, el factor común no es el estilo — es el mercado.',
      'La cabecera del bot afirmaba que el edge existía antes de 2019 apoyándose en los $9.520 de 2015-2018. La cifra es correcta; la conclusión no. Medido con el mismo corte que el resto de la cartera, el periodo anterior a julio de 2020 es negativo, y ese resultado depende enteramente de 2017.',
      'La muestra es la más pequeña del conjunto: 131 operaciones en 11,6 años. Con once operaciones al año, cualquier conclusión sobre cambios de comportamiento necesitará años para formarse.',
      'Es el bot con la recuperación más lenta: 1.040 días de máximo tiempo bajo el agua, casi tres años, con un periodo plano de 387 días.',
    ],
    riesgos: [
      { etiqueta: 'Peor escenario conocido', valor: 'Comprar un desplome de forma escalonada', nota: 'En febrero de 2020 costó -$20.407 en NQ. El drawdown máximo no es un único evento: es acumulación.' },
      { etiqueta: 'Peor operación', valor: '-$15.721 en NQ', nota: 'El 19 de enero de 2022.' },
      { etiqueta: 'Recuperación', valor: 'Hasta 1.040 días bajo el agua' },
      { etiqueta: 'Parámetro intocable', valor: 'ExitSMAPeriod = 3', nota: 'Pasarlo de 3 a 6 mantiene las posiciones 5,58 días en vez de 3,49, y eso triplicó el peor trade hasta -$40.401 en una sola operación.' },
    ],
    configProduccion: [
      { etiqueta: 'Instrumento y gráfico', valor: 'MNQ · diario · CME US Index Futures ETH' },
      { etiqueta: 'Entrada', valor: 'RSI(3) < 25 con el cierre por encima de la SMA(200)' },
      { etiqueta: 'Salida', valor: 'Cuando el cierre supera la SMA(3)' },
      { etiqueta: 'Stop', valor: 'Ninguno, y por diseño' },
      { etiqueta: 'Contratos', valor: '1' },
      { etiqueta: 'Dirección', valor: 'Solo compras' },
    ],
  },

  // ────────────────────────── ZigZag Breakout ───────────────────────────
  {
    slug: 'zigzag-breakout',
    nombre: 'ZigZag Breakout',
    subtitulo: 'La estrategia más débil de la cartera, y la que más falta hacía',
    enUnaFrase:
      'Rompe zonas de soporte y resistencia construidas sobre pivotes ZigZag del 0,02 %, exigiendo que la vela que rompe tenga cuerpo y que el camino al objetivo esté limpio.',
    estilo: 'Ruptura de estructura',
    instrumento: 'MNQ',
    grafico: '5 minutos',
    sesion: 'RTH',
    direccion: 'Solo largos',
    contratos: 1,
    desdeFaseE: '2026-08-11',
    comoOpera: [
      { etiqueta: 'Zonas', valor: 'Soportes y resistencias sobre pivotes ZigZag del 0,02 % del precio' },
      {
        etiqueta: 'Vela con fuerza',
        valor: 'El cuerpo de la vela que rompe debe ser al menos el 40 % de su rango',
        nota: 'Una vela con mecha larga y cuerpo pequeño indica que la ruptura se está rechazando, no confirmando.',
      },
      {
        etiqueta: 'Camino limpio',
        valor: 'Ninguna otra zona viva puede interponerse entre la entrada y el objetivo',
        nota: 'Si hay una zona en medio, el recorrido está bloqueado y la operación no se toma.',
      },
      { etiqueta: 'Stop', valor: 'Al otro lado de la zona, menos 2 puntos' },
      { etiqueta: 'Objetivo', valor: '2,0 veces el riesgo' },
      { etiqueta: 'Ventana', valor: '09:30 – 10:30 de Nueva York · un trade al día' },
      { etiqueta: 'Zonas heredadas', valor: 'Las que siguen sin perforar al abrir la sesión aportan unas 35 de sus operaciones' },
    ],
    metricasTesis: {
      netoNQ: 180_470,
      drawdownNQ: -38_630,
      probability: 13.84,
    },
    aporteCartera: {
      netoSobreDrawdownSinElla: 18.15,
      coste: -3.64,
      ratioRegimen: '1,4×',
      tAnterior: 1.08,
      tPosterior: 1.52,
      correlaciones: [
        { con: 'Momentum de Apertura', media: 0.58, peoresDias: -0.48 },
        { con: 'Weekend Effect', media: 0.46, peoresDias: -0.32 },
        { con: 'Overnight Drift', media: 0.06, peoresDias: -0.38 },
      ],
      nota: 'Aportó $7.705 en el régimen anterior a julio de 2020. Las otras cuatro estrategias juntas aportaron $3.490: más del doble que toda la cartera restante, en el único tramo de historia donde el régimen era distinto.',
    },
    loQueSostiene: [
      'Es la menos dependiente del régimen de las seis. Débil en los dos mundos, pero débil de forma consistente — y en una cartera eso vale más que fuerte de forma condicional.',
      'Gana cuando los demás pierden. De media correlaciona positivamente con Momentum (+0,58) y Weekend (+0,46), lo que parecería redundante, pero en el 10 % de peores días del portafolio el signo se invierte en los tres pares.',
      'En cuanto a diseño es el bot mejor construido de la cartera: todos sus parámetros ya eran porcentajes o ratios, así que no hubo nada que corregir. En los otros tres hubo que arreglar umbrales absolutos que llevaban años deformándose solos.',
      'Quitarlo cuesta más Net/DD que quitar el Momentum o el Weekend, que nunca estuvieron en discusión.',
    ],
    loQueNoCumple: [
      'Es la más débil de la cartera medida en solitario: t-stat de 1,90 y Probability del 13,84 % sobre 532 operaciones. Con una desviación de $4.249 por operación harían falta unas mil operaciones — veintidós años — para llevar el t-stat a 2,5. Nunca se va a poder validar por sí sola.',
      'Concentración extrema: diez operaciones de 532 producen el 96 % del beneficio. Las otras 521 producen $7.973 en once años y medio.',
      'Los últimos dieciocho meses restan: desde marzo de 2025 le cuesta $1.789 al conjunto y baja el Net/DD del portafolio de 7,30 a 5,59 en ese tramo.',
      'Estuvo veinticuatro horas fuera de la cartera. Se sacó aplicándole el listón de «¿es rentable por sí sola?», y con ese criterio suspende. El error fue de método: la pregunta de un portafolio es si aporta más de lo que quita al conjunto.',
    ],
    riesgos: [
      { etiqueta: 'Tamaño', valor: 'Un contrato, y nunca más', nota: 'Entra por descorrelación, no por retorno. Subirle el tamaño añadiría su varianza sin añadir proporcionalmente su beneficio.' },
      { etiqueta: 'Papel en la cartera', valor: 'Cobertura, no motor', nota: 'Los motores son el RSI2 y el Overnight Drift.' },
      { etiqueta: 'Concentración', valor: '96 % del beneficio en 10 operaciones', nota: 'No admite pausas discrecionales.' },
      { etiqueta: 'Temporalidad', valor: '5 minutos, no negociable', nota: 'De ella depende el alcance de la memoria entre sesiones, que es lo que lo distingue de una ruptura de apertura convencional.' },
    ],
    configProduccion: [
      { etiqueta: 'Instrumento y gráfico', valor: 'MNQ · 5 minutos · CME US Index Futures RTH' },
      { etiqueta: 'Desviación ZigZag', valor: '0,02 % del precio' },
      { etiqueta: 'Ventana de entrada', valor: '09:30 – 10:30 hora de Nueva York · un trade al día' },
      { etiqueta: 'Alcance máximo de la vela', valor: '0,5 veces la distancia al pivote del stop' },
      { etiqueta: 'Cierre mínimo (momentum)', valor: '0,40' },
      { etiqueta: 'Stop', valor: 'Pivote anterior más cercano, menos 2 puntos' },
      { etiqueta: 'Modo de salida', valor: 'Cierre de sesión, sin objetivo de beneficio' },
      { etiqueta: 'Riesgo por operación', valor: '$300 en MNQ · $3.000 en NQ' },
      { etiqueta: 'Dirección y contratos', valor: 'Solo largos · 1 contrato, no más' },
    ],
    diagramas: [
      {
        archivo: 'zigzag-breakout-vela-con-fuerza.png',
        titulo: 'Vela con fuerza',
        descripcion: 'El cuerpo de la vela que rompe debe ser al menos el 40 % de su rango total. Una mecha larga con cuerpo pequeño señala rechazo, no confirmación.',
      },
      {
        archivo: 'zigzag-breakout-zonas-heredadas.png',
        titulo: 'Zonas heredadas',
        descripcion: 'Las zonas de días anteriores que siguen sin perforar al abrir la sesión permanecen vivas. Aportan unas 35 de las 532 operaciones y son el rasgo que distingue a esta estrategia de una ruptura de apertura convencional.',
      },
    ],
    discrepancias: [
      'La tesis individual publica t-stat 1,90, Probability 13,84 % y 532 operaciones. El documento de cartera, escrito un día después, recoge 1,82, 13,10 % y 531. Aquí se toma la tesis individual como fuente; el CSV de operaciones confirma las 532.',
    ],
  },

  // ─────────────────────────── Weekend Effect ───────────────────────────
  {
    slug: 'weekend-effect',
    nombre: 'Weekend Effect',
    subtitulo: 'Domingo por la noche, lunes por la tarde y un stop que llevaba once años deformándose solo',
    enUnaFrase:
      'Compra el Nasdaq el domingo a las 21:00, cuando abre la sesión asiática, y lo cierra el lunes a las 15:00, solo si el cierre diario está por encima de la media exponencial de 100 días.',
    estilo: 'Calendario',
    instrumento: 'MNQ',
    grafico: '1 minuto',
    sesion: 'ETH',
    direccion: 'Solo largos',
    contratos: 1,
    desdeFaseE: '2026-08-11',
    comoOpera: [
      { etiqueta: 'Entrada', valor: 'Domingo a las 21:00, cuando abre la sesión asiática' },
      { etiqueta: 'Salida', valor: 'Lunes a las 15:00' },
      { etiqueta: 'Filtro', valor: 'EMA de 100 sobre velas diarias', nota: 'Evita comprar el rebote en mercados bajistas, que es donde el efecto se invierte.' },
      { etiqueta: 'Stop', valor: '0,87 % del precio de entrada' },
      {
        etiqueta: 'Re-entrada',
        valor: 'Inmediata, con un tope de dos entradas por domingo',
        nota: 'Está fija, no es configurable: aporta un 13 % más de beneficio con el mismo drawdown, y esperar solo empeora.',
      },
    ],
    metricasTesis: {
      netoNQ: 153_638,
      drawdownNQ: -23_172,
      probability: 0.21,
      maxTiempoRecuperacion: 980,
    },
    aporteCartera: {
      netoSobreDrawdownSinElla: 15.98,
      coste: -5.81,
      ratioRegimen: '5,3×',
      tAnterior: 0.58,
      tPosterior: 3.07,
      correlaciones: [
        { con: 'ZigZag Breakout', media: 0.46, peoresDias: -0.32 },
        { con: 'Momentum de Apertura', media: 0.77, peoresDias: null },
      ],
      nota: 'Es la segunda pieza más cara de perder del conjunto, por detrás del RSI2.',
    },
    loQueSostiene: [
      'El efecto fin de semana en índices está bien documentado: la apertura del domingo recoge el flujo acumulado durante el cierre.',
      'Se corrigió un defecto estructural que el propio código llevaba anotado: el stop estaba en dólares absolutos y llevaba once años cambiando de significado. Los $4.000 equivalían al 4,65 % del índice en 2015 y al 0,87 % hoy — la estrategia se apretaba sola cinco veces sin que nadie tocara nada.',
      'El nuevo stop porcentual no salió de una optimización: el 0,87 % es exactamente lo que valían los $4.000 con el Nasdaq en 23.000. Reproduce el comportamiento actual sin cambiarlo.',
      'Ventaja colateral: un porcentaje es el mismo número en NQ que en MNQ, lo que elimina una fuente de errores que ya había echado a perder una corrida entera.',
    ],
    loQueNoCumple: [
      'El edge es posterior a julio de 2020. Los 5,5 años anteriores dan un t-stat de 0,58 sobre 205 operaciones: estadísticamente, nada. Es el cuarto bot consecutivo de la cartera con esta firma.',
      'La mejora del stop porcentual no está distribuida: sobre 2015-2025 el cambio resta $7.426, y la totalidad de la ganancia procede de 2026, el único año en que el stop nuevo resulta más ancho que el fijo. No hay evidencia de que rinda más; hay evidencia de que no rinde menos, y eso basta para adoptarlo por diseño.',
      'El arreglo es parcial. Con el stop porcentual la frecuencia de ejecución sigue yendo del 6,6 % al 23,8 % según el periodo: mejor que el 0 %-20,2 % de antes, pero lejos de ser estable. Un porcentaje normaliza el nivel del índice, no el régimen de volatilidad.',
      'Veinte operaciones — un 4,5 % del total — producen el 87 % del beneficio. Implica una condición operativa clara: hay que estar encendido los domingos buenos, porque son pocos y son casi todo.',
      'El cambio empeoró dos métricas: el tiempo máximo de recuperación pasó de 595 a 980 días y la peor operación de -$4.016 a -$5.206.',
    ],
    riesgos: [
      { etiqueta: 'Concentración', valor: '87 % del beneficio en 20 operaciones', nota: 'Hay que estar encendido los domingos buenos.' },
      { etiqueta: 'Peor operación', valor: '-$5.206 en NQ' },
      { etiqueta: 'Recuperación', valor: 'Hasta 980 días' },
      { etiqueta: 'Plantilla', valor: 'ETH es un requisito, no una preferencia', nota: 'El bot entra el domingo por la noche, cuando la sesión regular está cerrada. Con plantilla RTH no operaría nunca.' },
    ],
    configProduccion: [
      { etiqueta: 'Instrumento y gráfico', valor: 'MNQ · 1 minuto · CME US Index Futures ETH' },
      { etiqueta: 'Entrada', valor: 'Domingo 21:00 · máximo 2 entradas por sesión' },
      { etiqueta: 'Salida', valor: 'Lunes 15:00' },
      { etiqueta: 'Filtro', valor: 'EMA 100 sobre velas diarias' },
      { etiqueta: 'Stop', valor: '0,87 % del precio de entrada' },
      { etiqueta: 'Re-entrada tras stop', valor: 'Inmediata (fija, no configurable)' },
      { etiqueta: 'Contratos', valor: '1' },
    ],
  },

  // ────────────────────────── Momentum Apertura ─────────────────────────
  {
    slug: 'momentum-apertura',
    nombre: 'Momentum de Apertura',
    subtitulo: 'Ruptura de volatilidad en la primera hora',
    enUnaFrase:
      'Compra rupturas de volatilidad durante la primera hora de la sesión: cuando el precio cierra sobre la banda superior de Bollinger, con el RSI confirmando y la tendencia mayor a favor.',
    estilo: 'Momentum intradía',
    instrumento: 'MNQ',
    grafico: '30 minutos',
    sesion: 'RTH',
    direccion: 'Solo largos',
    contratos: 1,
    desdeFaseE: '2026-08-11',
    comoOpera: [
      {
        etiqueta: 'Entrada',
        valor: 'Cierre sobre la banda superior de Bollinger(20; 2,0), RSI(14) suavizado a 3 por encima de 65, y precio sobre la EMA(200)',
        nota: 'El uso del RSI es contraintuitivo: en la lectura clásica un RSI sobre 65 significa «sobrecomprado, no compres». Aquí se emplea al revés, como confirmación de que la ruptura lleva inercia.',
      },
      { etiqueta: 'Ventana', valor: '09:30 – 10:30 de Nueva York', nota: 'El momentum del Nasdaq vive en los primeros sesenta minutos: sin filtro horario el beneficio medio cae de $49 a $23.' },
      { etiqueta: 'Stop', valor: 'No hay stop inicial fijo', nota: 'El trailing de 2,0 ATR protege desde la entrada.' },
      { etiqueta: 'Objetivo', valor: 'Ninguno. La posición corre hasta el cierre de sesión' },
      { etiqueta: 'Cortacircuitos', valor: 'Si la pérdida del día cruza el 0,065 % del precio, cierra y bloquea la jornada' },
    ],
    metricasTesis: {
      netoNQ: 63_686,
      drawdownNQ: -9_831,
      probability: 0.2,
      rCuadrado: 0.88,
      maxTiempoRecuperacion: 511,
    },
    aporteCartera: {
      netoSobreDrawdownSinElla: 20.02,
      coste: -1.77,
      ratioRegimen: '2,0×',
      tAnterior: 1.42,
      tPosterior: 2.86,
      correlaciones: [
        { con: 'Overnight Drift', media: 0.29, peoresDias: -0.72 },
        { con: 'ZigZag Breakout', media: 0.58, peoresDias: -0.48 },
        { con: 'Weekend Effect', media: 0.77, peoresDias: null },
      ],
      nota: 'Es la pieza menos cara de perder, pero quitarla sigue costando 1,77 puntos de Net/DD: ninguna es prescindible.',
    },
    loQueSostiene: [
      'Es el bot con mejor relación beneficio-riesgo de la cartera: un drawdown de solo -$983 en MNQ.',
      'El cortacircuitos es, según la propia documentación del bot, el mayor generador de rentabilidad del sistema: el profit factor pasa de 1,33 sin él a 1,77 con él. No es una medida de protección accesoria, es el motor.',
      'Se corrigió su deriva: estaba expresado en $300 absolutos y había pasado de cortar una de cada once operaciones a cortar la mitad, sin que nadie tocara un parámetro. Ahora es el 0,065 % del precio.',
      'A diferencia del Weekend Effect, aquí la mejora del cambio está distribuida: siete años mejoran y uno empeora. Y arregla retroactivamente un periodo antiguo que estaba peor gestionado de lo que parecía.',
      'La temporalidad de 30 minutos está validada por barrido: 5 min da Net/DD 0,62, 15 min 2,46 y 30 min 4,40.',
    ],
    loQueNoCumple: [
      'Es el más concentrado de la cartera, y ése es su problema serio: las veinte mejores operaciones valen más que todo el beneficio del sistema. Las otras trescientas siete, en conjunto, pierden dinero. Seis de cada cien operaciones cargan con la estrategia entera.',
      'La implicación operativa es concreta: este bot no admite pausas discrecionales. Basta con estar apagado en cuatro o cinco fechas para que el año se caiga.',
      'La dependencia de régimen es mayor de lo que parecía. Tras obligar el cierre antes del contado, el t-stat del tramo anterior a julio de 2020 baja de 1,42 a 0,97. Dejó de ser el más resistente de la cartera en ese periodo; el ZigZag y el IBS aguantan mejor.',
      '2025 cerró en negativo (-$2.989) con un 56 % de operaciones cortadas por el cortacircuitos.',
      'La Fase E destapó una mecánica que ningún backtest hacía evidente: el cortacircuitos suma el resultado no realizado de la posición abierta, así que lo diseñado como tope diario funciona además como stop de cada operación individual, a 19,65 puntos — 8,8 veces más estrecho que el trailing que aparece dibujado en el gráfico.',
    ],
    riesgos: [
      { etiqueta: 'Concentración', valor: 'No admite pausas discrecionales', nota: 'El top-20 vale más que el 100 % del beneficio.' },
      { etiqueta: 'Asimetría del corte', valor: 'El cortacircuitos se evalúa solo al cierre de cada vela de 30 minutos', nota: 'Dentro de una vela la única protección es el trailing, con sus 172 puntos. El sistema tolera un desplome rápido y no tolera una deriva lenta.' },
      { etiqueta: 'Pérdida diaria real', valor: 'Supera siempre el límite nominal', nota: 'El PnL se comprueba al cierre de barras de 30 min.' },
      { etiqueta: 'Temporalidad', valor: '30 minutos, no negociable' },
      { etiqueta: 'Dimensionamiento', valor: '1 contrato MNQ', nota: 'Drawdown de -$983 en micro.' },
    ],
    configProduccion: [
      { etiqueta: 'Instrumento y gráfico', valor: 'MNQ · 30 minutos · CME US Index Futures RTH' },
      { etiqueta: 'Bandas de Bollinger', valor: 'Periodo 20 · 2,0 desviaciones' },
      { etiqueta: 'RSI', valor: 'Periodo 14 · suavizado 3 · umbral 65' },
      { etiqueta: 'ATR', valor: 'Periodo 14' },
      { etiqueta: 'Filtro de tendencia', valor: 'EMA 200, activo' },
      { etiqueta: 'Ventana de entrada', valor: '09:30 – 10:30 hora de Nueva York' },
      { etiqueta: 'Trailing', valor: '2,0 ATR · es el único stop' },
      { etiqueta: 'Cortacircuitos diario', valor: '0,065 % del precio' },
      { etiqueta: 'Dirección y contratos', valor: 'Solo largos · 1 contrato' },
    ],
    discrepancias: [
      'El t-stat del tramo anterior a julio de 2020 aparece como 1,42 y como 0,97 en dos puntos de la tesis, según se aplique o no el cierre antes del contado del 16 de agosto de 2026. La cifra vigente es 0,97.',
    ],
  },

  // ─────────────────────────── IBS Reversion ────────────────────────────
  {
    slug: 'ibs-reversion',
    nombre: 'IBS Reversion',
    subtitulo: 'La señal que sobrevivió al test de control y el error de escala que casi la descarta',
    enUnaFrase:
      'Cuando la sesión cierra en el tercio inferior de su propio rango estando por encima de la media de 200 sesiones, compra en la apertura del día siguiente y cierra esa misma tarde.',
    estilo: 'Reversión intradía',
    instrumento: 'MNQ',
    grafico: '5 minutos',
    sesion: 'RTH',
    direccion: 'Solo largos',
    contratos: 1,
    desdeFaseE: '2026-08-16',
    comoOpera: [
      {
        etiqueta: 'Señal',
        valor: 'IBS = (Cierre − Mínimo) / (Máximo − Mínimo) por debajo de 0,20',
        nota: 'El Internal Bar Strength mide dónde cerró el precio dentro del rango del propio día. Un valor de 0,05 significa que cerró pegado al mínimo.',
      },
      { etiqueta: 'Filtro', valor: 'El precio debe estar sobre la SMA de 200 sesiones' },
      { etiqueta: 'Entrada', valor: 'En la apertura del día siguiente, a las 09:30' },
      { etiqueta: 'Salida', valor: 'Al cierre de esa misma sesión', nota: 'No mantiene ninguna noche: es puramente intradía por diseño.' },
      { etiqueta: 'Stop / objetivo', valor: 'Ninguno' },
    ],
    metricasTesis: {
      netoNQ: 63_115,
      drawdownNQ: -25_946,
    },
    aporteCartera: {
      netoSobreDrawdownSinElla: 19.76,
      coste: -2.03,
      ratioRegimen: '1,20×',
      tAnterior: null,
      tPosterior: null,
      correlaciones: [{ con: 'Overnight Drift', media: -0.038, peoresDias: null }],
      nota: 'Añadirlo bajó el drawdown del conjunto en $102 y subió el Net/DD de 19,76 a 21,79. Ningún candidato anterior había conseguido reducir el drawdown al entrar. Aporta $2.470 en el 10 % de peores días de la cartera.',
    },
    loQueSostiene: [
      'Tiene la prueba de fondo que ninguno de los cinco candidatos descartados tenía: un test de control que demuestra por qué funciona, no solo que funcionó. Se barrió el umbral hasta 0,90, donde entra prácticamente cualquier día que esté sobre la SMA200 — la entrada incondicional. El control pierde dinero: profit factor 0,99 y -$19.662 en 1.845 operaciones.',
      'Por tanto el beneficio no viene de estar largo del Nasdaq: viene del filtro. Y la forma de la curva es la de una señal con contenido — meseta plana mientras la condición es informativa, rodilla entre 0,40 y 0,50, y colapso justo donde el umbral deja de significar algo.',
      'Es información distinta al RSI2, no una variante: el RSI(3) mide impulso acumulado de varios días y el IBS mide uno solo, ignorando por completo lo anterior. Disparan en días diferentes, que es la condición necesaria para aportar en lugar de duplicar.',
      'Es puramente intradía a propósito. La versión clásica del IBS es cierre a cierre, pero ese tramo contiene la noche, que ya es propiedad del Overnight Drift. La correlación resultante entre ambos es de -0,038: el diseño funcionó.',
      'Su ratio de dependencia de régimen es 1,20 veces, el más bajo de las seis estrategias.',
      'Ninguno de los veinte parámetros del barrido pierde dinero y diecinueve superan un profit factor de 1,20. El valor por defecto queda noveno de veinte, ni siquiera en la zona alta: es lo que se espera cuando no se ha optimizado nada.',
    ],
    loQueNoCumple: [
      'El t-stat es de 1,26, muy por debajo del 2,0 que se exigía. Bajó desde 1,64 al obligar el cierre antes del contado, y ya era el punto débil de la estrategia.',
      'Las tres mejores operaciones son el 50,4 % del beneficio, cuando el criterio pedía un máximo del 30 %. El atenuante es real pero parcial: recortando cinco operaciones de cada cola el t-stat sube a 1,54, o sea que los extremos restan en vez de sostener.',
      'Sesgo de selección: es la sexta idea sometida a este proceso. Con seis intentos, el máximo esperado por puro azar ronda un t-stat de 1,3. Lo único que escapa a esa crítica es el test de control.',
      'El criterio de régimen fijado antes de correr nada exigía un t-stat superior a 1,5 en 2015 – junio 2020, y dio 1,12. Se considera cumplido el propósito del criterio porque la métrica comparaba dólares ganados con el Nasdaq a 10.000 contra dólares con el Nasdaq a 20.000; corregida por el nivel del índice, el periodo antiguo conserva el 96 % de la amplitud de la señal. Pero el número concreto que se fijó no se alcanza.',
      'El cierre antes del contado costó caro: el beneficio bajó de $84.170 a $63.115, un 25 %. Se hizo igualmente porque buena parte de ese beneficio probablemente no era capturable — los spreads después del cierre del contado son más anchos.',
    ],
    riesgos: [
      { etiqueta: 'Stop', valor: 'No lleva', nota: 'Coherente con el resto de la cartera y con la naturaleza de la posición: intradía, cerrada antes del final de la sesión, sin exposición nocturna. El control es el tamaño y el propio horario.' },
      { etiqueta: 'Frecuencia', valor: '28 operaciones al año' },
      { etiqueta: 'Plantilla', valor: 'RTH es un requisito, no una preferencia', nota: 'El IBS se calcula sobre el rango de esa sesión. Con plantilla ETH el indicador mediría un rango de 23 horas y estaría midiendo otra cosa.' },
      { etiqueta: '2022', valor: 'Solo cuatro operaciones', nota: 'El filtro de tendencia bloqueó casi todo el año bajista.' },
    ],
    configProduccion: [
      { etiqueta: 'Instrumento', valor: 'MNQ', nota: 'Validado sobre NQ por histórico.' },
      { etiqueta: 'Gráfico', valor: '5 minutos', nota: 'Plantilla RTH obligatoria.' },
      { etiqueta: 'Umbral IBS', valor: '0,20', nota: 'De la literatura, no optimizado.' },
      { etiqueta: 'Periodo SMA', valor: '200', nota: 'Media canónica de la cartera.' },
      { etiqueta: 'Contratos', valor: '1, y solo uno' },
      { etiqueta: 'Log de diagnóstico', valor: 'Desactivado', nota: 'Activar solo para auditar.' },
    ],
    graduacion:
      'Pasa a capital real solo si tras 40 operaciones en simulado el beneficio medio por operación se mantiene por encima del 0,05 % del nocional. Por debajo de esa cifra se retira. Con unas 28 operaciones al año, son aproximadamente 17 meses de Fase E. Se dejó escrito antes de encenderlo para que la decisión no dependa de cómo se vea la curva dentro de año y medio.',
  },
]

/** Devuelve la ficha de una estrategia, o `undefined` si el slug no existe. */
export function fichaPorSlug(slug: string): FichaEstrategia | undefined {
  return CATALOGO.find(f => f.slug === slug)
}

export const SLUGS = CATALOGO.map(f => f.slug)
