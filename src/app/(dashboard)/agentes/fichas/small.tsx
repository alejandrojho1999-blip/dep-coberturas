import type { Ficha } from './tipos'

/**
 * Ficha del AGENTE SMALL.
 *
 * Los umbrales están escritos a mano y deben seguir a su fuente si esta cambia:
 *   · paso 1      → `lib/peter-lynch/screener.ts` (SMALL_CAP_OPTIONS y
 *                   SMALL_CAP_TICKERS) y el corte `score >= 4` de `AgenteSmall.tsx`
 *   · paso 2      → `api/agentes/forecast/route.ts`
 *   · paso 3      → `api/agentes/momentum/route.ts`
 *   · paso 4      → `api/agentes/analyze/route.ts` y el filtro de `AgenteSmall.tsx`
 *   · salida      → bloque de re-evaluación de `AgenteSmall.tsx`
 */
export const FICHA_SMALL: Ficha = {
  subtitulo: 'Cómo selecciona, cuándo vende y qué respaldo tiene',

  intro: (
    <>
      El <strong className="text-text-primary">Agente Small</strong>{' '}
      aplica la misma mecánica que el Agente Peter, pero sobre 307 empresas
      pequeñas del S&amp;P&nbsp;600 y el Russell&nbsp;2000, y con criterios de
      valoración adaptados a ellas. Es el mismo{' '}
      <strong className="text-text-primary">embudo de cuatro filtros en cascada</strong>,
      con los tres primeros deterministas y el cuarto por IA. La diferencia de
      fondo está en el primer filtro: aquí{' '}
      <strong className="text-text-primary">no se exige la nota perfecta</strong>,
      porque en empresas pequeñas los seis criterios rara vez se dan a la vez.
    </>
  ),

  pasos: [
    {
      n: '01',
      titulo: 'Screener small cap',
      fuente: 'Fundamentales · Yahoo Finance',
      criterio: 'Los mismos seis criterios de Lynch con cortes propios, 1 punto cada uno: P/E histórico < 20, P/E proyectado < 18, deuda neta sobre capitalización < 0,5, crecimiento de beneficio > 15 %, PEG < 1,5 y capitalización entre $100 M y $2 B.',
      umbral: 'Exige ≥ 4/6',
    },
    {
      n: '02',
      titulo: 'Proyección a 30 días',
      fuente: 'Precios · 60 sesiones',
      criterio: 'Regresión lineal sobre los 60 últimos cierres proyectada 30 sesiones, promediada 60/40 con una media exponencial de los 30 últimos.',
      umbral: 'Exige ≥ +2 %',
    },
    {
      n: '03',
      titulo: 'Momentum',
      fuente: 'Precio y volumen',
      criterio: 'Tres señales independientes: RSI-14 entre 50 y 75, MACD por encima de su línea de señal, y volumen de 5 sesiones ≥ 1,1× el de 20.',
      umbral: 'Exige ≥ 2/3',
    },
    {
      n: '04',
      titulo: 'Revisión por IA',
      fuente: 'Modelo de lenguaje',
      criterio: 'Un modelo revisa el conjunto desde tres ángulos —técnico, fundamental y gestor de cartera— y emite una convicción de 1 a 10 junto con una dirección.',
      umbral: 'Exige ≥ 7/10 y COMPRA',
    },
  ],

  notaEmbudo: (
    <>
      Conviene entender qué significa exigir 4 de 6 y no los seis: los dos
      criterios que un candidato incumple pueden ser cualesquiera,{' '}
      <strong className="text-text-secondary">incluido el de capitalización</strong>.
      Un valor con 4/6 puede quedar fuera del rango $100 M – $2 B y aun así pasar,
      porque el tamaño puntúa como un criterio más y no actúa como filtro duro.
      El resultado es un embudo bastante menos restrictivo que el de Peter y, por
      tanto, más señales y menos exigencia por señal.
    </>
  ),

  cuandoVende: (
    <>
      Igual que el Agente Peter: en cada ejecución vuelve a evaluar las posiciones
      abiertas contra los tres filtros objetivos y{' '}
      <strong className="text-text-primary">vende si fallan dos de los tres</strong>.
      La salida responde al deterioro de las condiciones que justificaron la
      entrada, no a un objetivo de precio, y no hay toma de beneficios automática.
      Si alguno de los datos no llega a tiempo, ese filtro cuenta como superado:
      la duda no dispara una venta.
    </>
  ),

  garantias: [
    {
      titulo: 'El precio de entrada es siempre real',
      detalle: 'Se registra el precio de mercado del momento. Si no se puede obtener, la recomendación se descarta en lugar de completarse con una estimación: una entrada inventada falsearía el rendimiento durante toda la vida de la posición.',
    },
    {
      titulo: 'El precio objetivo prioriza el consenso',
      detalle: 'Se usa el objetivo medio de los analistas que cubren el valor. Solo si no existe se recurre a la cifra del modelo, y el origen queda registrado en cada recomendación para poder auditarlo.',
    },
    {
      titulo: 'Los umbrales están fijados en el código',
      detalle: 'Ninguno se ajusta sobre la marcha ni depende del criterio del operador. Cambiar uno exige modificar el código y queda en el historial de versiones.',
    },
    {
      titulo: 'Las recomendaciones no se sobrescriben',
      detalle: 'Una nueva ejecución no reescribe el precio de entrada de una posición ya abierta. Sin esa regla, cada corrida reiniciaría el rendimiento a cero y se perdería el seguimiento desde la fecha real de la recomendación.',
    },
  ],

  validacion: [
    {
      id: 'sin-backtest',
      texto: (
        <>
          <strong style={{ color: 'var(--color-warning)' }}>Este agente no tiene backtest.</strong>{' '}
          Su respaldo hoy es el historial en vivo que se acumula desde la primera
          recomendación guardada, visible en la sección Portafolios y comparado
          contra el S&amp;P&nbsp;500. Es un registro real y sin retoques, pero
          todavía corto.
        </>
      ),
    },
    {
      id: 'sesgo-supervivencia',
      texto: (
        <>
          Los obstáculos para backtestear el primer filtro son los mismos que en el
          Agente Peter —fundamentales revisados a posteriori y lista de miembros del
          índice cambiante— y aquí{' '}
          <strong className="text-text-primary">pesan más</strong>: las empresas
          pequeñas quiebran, salen del índice y son absorbidas con mucha más
          frecuencia que las grandes, así que medir solo sobre las que siguen vivas
          hoy exagera el resultado más todavía.
        </>
      ),
    },
    {
      id: 'hipotesis',
      texto: (
        <>
          A cambio, el universo pequeño es donde la metodología de Lynch tiene más
          sentido teórico: menos cobertura de analistas, más ineficiencias. Es una{' '}
          <em>hipótesis razonable</em>, no un resultado medido.
        </>
      ),
    },
  ],

  lectura: (
    <>
      Lectura recomendada para una decisión de capital: este agente es
      <strong className="text-text-secondary"> menos exigente que el Peter</strong>{' '}
      —4 de 6 criterios frente a 6 de 6— sobre empresas más volátiles y menos
      líquidas. Produce más señales, y cada una vale menos por sí sola.
      Dimensionar por debajo de lo que se asigne al Peter, no por encima.
    </>
  ),
}
