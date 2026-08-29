import Link from 'next/link'
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
      id: 'backtest-hecho',
      texto: (
        <>
          <strong className="text-text-primary">Este agente sí tiene backtest</strong>, y es el
          único de los cuatro cuyo resultado apunta en la dirección de la tesis. Medido contra
          IJR —el S&amp;P&nbsp;600, que es de donde sale su universo— el screener Lynch sin
          capas técnicas rinde un{' '}
          <strong className="text-text-primary">22,06 % anual frente al 17,57 % del índice</strong>,
          con <em>information ratio</em> +0,57 y percentil 99,5 sobre 200 carteras aleatorias
          emparejadas por sector y decil de tamaño.{' '}
          <Link href="/agentes/backtest" className="underline underline-offset-2 hover:text-text-primary">
            Ver el backtest completo
          </Link>.
        </>
      ),
    },
    {
      id: 'benchmark-correcto',
      texto: (
        <>
          El índice de referencia importa tanto como el resultado: contra el S&amp;P&nbsp;500
          este mismo agente sale con IR −0,31, y contra IJR sale +0,57. Comparar una cartera de
          pequeña capitalización con el índice grande{' '}
          <strong className="text-text-primary">mide el segmento, no la selección</strong>. La
          cascada de producción, con sus capas técnicas, se queda en 18,32 % e IR +0,06:
          prácticamente el índice.
        </>
      ),
    },
    {
      id: 'no-concluyente',
      texto: (
        <>
          <strong style={{ color: 'var(--color-warning)' }}>No es una demostración.</strong>{' '}
          La ventana utilizable es de 28 meses —el criterio de crecimiento necesita dos
          ejercicios anuales y la fuente gratuita solo da cuatro, uno de ellos incompleto— y con
          esa muestra el t-stat es 0,82 frente al umbral convencional de 2,0. Es un indicio
          consistente en un solo régimen de mercado, no una ventaja probada.
        </>
      ),
    },
    {
      id: 'sesgo-supervivencia',
      texto: (
        <>
          El sesgo de supervivencia{' '}
          <strong className="text-text-primary">pesa más aquí</strong> que en el Agente Peter:
          las empresas pequeñas quiebran, salen del índice y son absorbidas con mucha más
          frecuencia. El backtest lo acota declarando el 8,9 % del universo sin precios
          recuperables en vez de ignorarlo, pero acotarlo no es eliminarlo, y el sesgo siempre
          favorece al resultado.
        </>
      ),
    },
    {
      id: 'siguiente-paso',
      texto: (
        <>
          Confirmarlo exige datos <em>point-in-time</em> de varios ciclos de mercado o un
          forward-test en vivo sobre las selecciones de solo-Lynch, en paralelo a producción.
          Hasta entonces la hipótesis —menos cobertura de analistas, más ineficiencias— sigue
          siendo razonable y medida una vez, no establecida.
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
