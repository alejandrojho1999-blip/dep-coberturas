/**
 * Contenido curado del expediente de cartera.
 *
 * Fuente: `Portafolio_6_Bots_MNQ.pdf` (16 de agosto de 2026), que es el
 * documento canónico del conjunto. Las tablas de aporte marginal, correlaciones
 * y dimensionamiento no se pueden derivar de los CSV, así que viven aquí.
 *
 * Todo lo que SÍ es calculable — curva combinada, drawdown, neto, reducción del
 * drawdown — sale de `public/estrategias/data/cartera.json`, que el script
 * genera sumando el PnL diario real de las seis series.
 */

export const CARTERA_META = {
  titulo: 'Portafolio de futuros',
  subtitulo: 'Seis sistemas algorítmicos sobre MNQ · un contrato cada uno',
  lema: 'Ninguna estrategia es perfecta. La cartera no necesita que lo sean.',
  cuenta: 50_000,
  periodo: '2015 – 2026',
  estado: 'Backtest · Fase E en simulado',
  autor: 'Luis Riofrío — Trader Cuantitativo · Futuros',
  fecha: '16 de agosto de 2026',
} as const

/**
 * Cuánto Net/DD pierde el conjunto al retirar cada estrategia.
 *
 * Es la medida honesta de aportación: no cuánto gana una estrategia, sino
 * cuánto se pierde sin ella. El orden no coincide con el de contribución
 * directa, y esa discrepancia es justamente el argumento de por qué se mide una
 * cartera y no seis sistemas sueltos.
 */
export const APORTE_MARGINAL = [
  { slug: 'rsi2-reversion', nombre: 'RSI2 Reversion', sinElla: 12.29, coste: -9.5 },
  { slug: 'weekend-effect', nombre: 'Weekend Effect', sinElla: 15.98, coste: -5.81 },
  { slug: 'overnight-drift', nombre: 'Overnight Drift', sinElla: 17.45, coste: -4.34 },
  { slug: 'zigzag-breakout', nombre: 'ZigZag Breakout', sinElla: 18.15, coste: -3.64 },
  { slug: 'ibs-reversion', nombre: 'IBS Reversion', sinElla: 19.76, coste: -2.03 },
  { slug: 'momentum-apertura', nombre: 'Momentum de Apertura', sinElla: 20.02, coste: -1.77 },
] as const

/**
 * Correlación media contra correlación restringida al 10 % de peores días.
 *
 * Es el hallazgo más útil del expediente: una cartera no la protege la
 * correlación promedio, sino la correlación condicionada al momento en que todo
 * va mal. El ZigZag correlaciona positivamente de media con Momentum y Weekend
 * —parecería redundante— pero en los días malos el signo se invierte.
 */
export const CORRELACIONES = [
  { par: 'Momentum – Overnight', media: 0.29, peoresDias: -0.72 },
  { par: 'RSI2 – Overnight', media: -0.12, peoresDias: -0.67 },
  { par: 'ZigZag – Momentum', media: 0.58, peoresDias: -0.48 },
  { par: 'ZigZag – Overnight', media: 0.06, peoresDias: -0.38 },
  { par: 'ZigZag – Weekend', media: 0.46, peoresDias: -0.32 },
  { par: 'IBS – Overnight', media: -0.038, peoresDias: null },
] as const

/**
 * Dependencia del régimen posterior a julio de 2020.
 *
 * Cuanto más bajo el cociente, menos depende la estrategia del cambio de
 * mercado. Cinco de las seis son estadísticamente nulas en el régimen antiguo:
 * no es correlación de retornos, es correlación de supuestos, y no aparece en
 * ninguna matriz de correlación diaria.
 */
export const DEPENDENCIA_REGIMEN = [
  { slug: 'ibs-reversion', nombre: 'IBS Reversion', tAnterior: null, tPosterior: null, ratio: '1,20×', netoAnterior: null },
  { slug: 'zigzag-breakout', nombre: 'ZigZag Breakout', tAnterior: 1.08, tPosterior: 1.52, ratio: '1,4×', netoAnterior: 7705 },
  { slug: 'momentum-apertura', nombre: 'Momentum de Apertura', tAnterior: 1.42, tPosterior: 2.86, ratio: '2,0×', netoAnterior: 963 },
  { slug: 'overnight-drift', nombre: 'Overnight Drift', tAnterior: 0.57, tPosterior: 2.44, ratio: '4,2×', netoAnterior: 1860 },
  { slug: 'weekend-effect', nombre: 'Weekend Effect', tAnterior: 0.58, tPosterior: 3.07, ratio: '5,3×', netoAnterior: 875 },
  { slug: 'rsi2-reversion', nombre: 'RSI2 Reversion', tAnterior: -0.11, tPosterior: 4.14, ratio: '∞', netoAnterior: -208 },
] as const

/** Escenarios de tamaño. El drawdown escala linealmente con los contratos. */
export const DIMENSIONAMIENTO = [
  { contratos: 1, drawdown: -4099, porcentajeCuenta: 8.2, regimenMalo: 2118, historico: 7714, recomendado: true },
  { contratos: 2, drawdown: -8198, porcentajeCuenta: 16.4, regimenMalo: 4236, historico: 15428, recomendado: false },
  { contratos: 3, drawdown: -12297, porcentajeCuenta: 24.6, regimenMalo: 6354, historico: 23142, recomendado: false },
  { contratos: 4, drawdown: -16396, porcentajeCuenta: 32.8, regimenMalo: 8472, historico: 30856, recomendado: false },
] as const

/** Con qué cifra planificar, según qué régimen venga. */
export const ESCENARIOS_ANUALES = [
  { escenario: 'Si sigue el régimen actual', dolares: 12_710, porcentaje: 25.4 },
  { escenario: 'Media histórica', dolares: 7_714, porcentaje: 15.4, recomendado: true },
  { escenario: 'Si vuelve el régimen antiguo', dolares: 2_118, porcentaje: 4.2 },
] as const

export const REGLAS_OPERATIVAS = [
  {
    titulo: 'Arrancar pequeño',
    detalle:
      'Un contrato por bot. El drawdown esperado es el 8,2 % de la cuenta y esa cifra ya asume el peor escenario medido. Revisar el tamaño cuando haya operativa real acumulada, no antes.',
  },
  {
    titulo: 'Encender los seis a la vez',
    detalle:
      'La ventaja principal de esta cartera es la reducción del drawdown del 74 %, y solo existe si las seis corren simultáneamente.',
  },
  {
    titulo: 'No pausar discrecionalmente',
    detalle:
      'El Momentum tiene más del 100 % de su beneficio en veinte operaciones y el ZigZag el 96 % en diez. Apagarlos unos días concretos puede costar el año entero.',
  },
  {
    titulo: 'Umbral de revisión',
    detalle:
      'Si el PnL móvil de doce meses del conjunto cae por debajo de -$4.099 —el peor drawdown medido— parar y revisar. No es un stop, es un punto de revisión.',
  },
  {
    titulo: 'El ZigZag nunca más de un contrato',
    detalle:
      'Entra por descorrelación, no por retorno. Subirle el tamaño añadiría su varianza sin añadir proporcionalmente su beneficio.',
  },
  {
    titulo: 'Seguir buscando descorrelación real',
    detalle:
      'Cinco de las seis dependen del régimen posterior a 2020. El ZigZag y el IBS amortiguan, pero no cubren. Cualquier estrategia adicional que dependa del mismo régimen no diversifica: solo escala la apuesta.',
  },
] as const

/**
 * Lo que se probó y no entró.
 *
 * Es la sección que más credibilidad da al conjunto: documenta los descartes con
 * el mismo detalle que las aprobaciones.
 */
export const DESCARTADOS = [
  {
    idea: 'ORB Regime',
    operaciones: 1423,
    profitFactor: null,
    probability: 4.34,
    motivo:
      'Correlaciona +0,707 con el Momentum: los dos son sistemas de impulso sobre 30 minutos en sesión regular que operan la primera parte del día, así que no diversifica, dobla. Su drawdown en solitario (-$5.491) es mayor que el de toda la cartera de entonces.',
    matiz:
      'No fue por ausencia de edge: con Probability del 4,34 % sobre 1.423 operaciones gana dinero de verdad. El problema es que su drawdown equivale al 52 % de todo lo que gana, y con MNQ el mínimo es un contrato — es todo o nada, y entero no cabe.',
  },
  {
    idea: 'Oro tras caídas del S&P',
    operaciones: 73,
    profitFactor: 1.73,
    probability: 8.18,
    motivo:
      'Sus tres mejores operaciones son el 85 % del beneficio y las cinco mejores el 119 %, de modo que sin ellas el sistema pierde dinero. Y las tres mayores son de los últimos diez meses: la señal no seleccionaba huidas hacia la calidad, seleccionaba un periodo.',
    matiz:
      'Fue el primer candidato realmente descorrelacionado: -0,121 con la cartera y +$1.134 en el 10 % de peores días. No bastó. Su lección es sobre el método: el profit factor no distingue una ventaja repetible de una cola derecha afortunada. La concentración sí.',
  },
  {
    idea: 'RSI2 espejo en corto',
    operaciones: 118,
    profitFactor: 0.96,
    probability: 47.65,
    motivo: 'Sin edge: el lado corto del mismo patrón no existe.',
  },
  {
    idea: 'Momentum de crudo',
    operaciones: 82,
    profitFactor: 0.71,
    probability: 98.3,
    motivo: 'Premisa falsificada. Sin banda muerta, 52 latigazos.',
  },
  {
    idea: 'Spread RTY/ES en reversión',
    operaciones: 59,
    profitFactor: 0.8,
    probability: 90.39,
    motivo: 'El edge bruto ya era negativo antes de aplicar fricción.',
  },
  {
    idea: 'Momentum ratio RTY/ES',
    operaciones: 19,
    profitFactor: 1.01,
    probability: 49.69,
    motivo: 'Indistinguible del azar, con un drawdown del 40 % del nocional.',
  },
] as const

export const LECCION_DESCARTES =
  'Las cuatro primeras comparten la misma lección: la descorrelación sin ventaja no vale nada. Un activo distinto no genera edge por el hecho de ser distinto, y añadir un sistema sin esperanza matemática positiva empeora el conjunto aunque su correlación con el resto sea cero.'

/** Advertencia de fondo. Va destacada, no en una nota al pie. */
export const RIESGO_ESTRUCTURAL = {
  titulo: 'El riesgo que comparten las seis',
  cuerpo:
    'Cinco de las seis estrategias son estadísticamente nulas antes de julio de 2020 y fuertes después. Ninguna supera un t-stat de 2 en el periodo antiguo. Eso no aparece en la correlación de resultados diarios, porque no es correlación de retornos: es correlación de supuestos. Las seis apuestan a que el mercado siga pareciéndose al de 2021-2026.',
  cierre:
    'El histórico contiene la respuesta a «qué pasa si no paga la apuesta», y la respuesta es cinco años y medio ganando poco mientras se soporta el drawdown más grande de todo el registro. La diferencia entre acertar y no acertar en esa pregunta es un Net/DD de 19,19 contra 2,82.',
} as const

export const NOTA_NATURALEZA =
  'Esta sección no es un portafolio en vivo. Es el backtest de seis sistemas de futuros sobre once años y medio de historia, en simulado y sin capital asignado. No se suma a los portafolios de acciones y opciones de las otras pestañas: son instrumentos, capital y naturaleza distintos.'
