import Link from 'next/link'
import type { Ficha } from './tipos'

/**
 * Ficha del AGENTE PETER.
 *
 * Los umbrales están escritos a mano y deben seguir a su fuente si esta cambia:
 *   · paso 1      → `lib/peter-lynch/screener.ts` (LARGE_CAP_OPTIONS) y el
 *                   corte `score === 6` de `AgentePeter.tsx`
 *   · paso 2      → `api/agentes/forecast/route.ts`
 *   · paso 3      → `api/agentes/momentum/route.ts`
 *   · paso 4      → `api/agentes/analyze/route.ts` y el filtro de `AgentePeter.tsx`
 *   · salida      → bloque de re-evaluación de `AgentePeter.tsx`
 */
export const FICHA_PETER: Ficha = {
  subtitulo: 'Cómo selecciona, cuándo vende y qué respaldo tiene',

  intro: (
    <>
      El <strong className="text-text-primary">Agente Peter</strong>{' '}
      aplica la metodología de Peter Lynch a un universo de 443 empresas del
      S&amp;P&nbsp;500 y el NASDAQ&nbsp;100. Es un{' '}
      <strong className="text-text-primary">embudo de cuatro filtros en cascada</strong>:
      una empresa solo llega a ser recomendación si supera los cuatro. Los tres
      primeros son deterministas —mismos datos, mismo resultado— y el cuarto es
      una revisión por IA.
    </>
  ),

  pasos: [
    {
      n: '01',
      titulo: 'Screener Lynch',
      fuente: 'Fundamentales · Yahoo Finance',
      criterio: 'Seis criterios de valoración, 1 punto cada uno: P/E histórico < 25, P/E proyectado < 15, deuda neta sobre capitalización < 0,35, crecimiento de beneficio > 15 %, PEG < 2 y capitalización > $5 B.',
      umbral: 'Exige 6/6',
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
      El primer filtro es el más restrictivo: exigir los seis criterios a la vez
      descarta la práctica totalidad del universo. El agente está diseñado para
      producir<strong className="text-text-secondary"> pocas señales</strong>, no
      muchas.
    </>
  ),

  cuandoVende: (
    <>
      En cada ejecución, el agente vuelve a evaluar las posiciones abiertas contra
      los tres filtros objetivos y{' '}
      <strong className="text-text-primary">vende si fallan dos de los tres</strong>.
      La salida responde al deterioro de las condiciones que justificaron la
      entrada, no a un objetivo de precio: una sola señal debilitándose no basta,
      pero dos simultáneas invalidan la tesis. No hay toma de beneficios
      automática.
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
          <strong className="text-text-primary">Este agente sí tiene backtest</strong>, y el
          resultado no lo respalda: sobre 28 meses de datos utilizables, la cascada completa
          rinde un <strong className="text-text-primary">14,06 % anual frente al 21,24 % del
          S&amp;P&nbsp;500</strong>, con un <em>information ratio</em> de −0,43 y un percentil
          de control de 1,5 sobre 100 carteras aleatorias emparejadas por sector y tamaño. En
          gran capitalización el screener no está seleccionando.{' '}
          <Link href="/agentes/backtest" className="underline underline-offset-2 hover:text-text-primary">
            Ver el backtest completo
          </Link>.
        </>
      ),
    },
    {
      id: 'sin-capas-tecnicas',
      texto: (
        <>
          Quitar las capas técnicas mejora las cuatro métricas —CAGR 16,67 %, IR −0,36,
          percentil 24,5— pero sigue por debajo del índice. La mejora es consistente con lo
          que se ve en el Agente Small, así que{' '}
          <strong className="text-text-primary">las capas 2 y 3 quedan bajo sospecha</strong>;
          no se retiran de producción con una muestra de este tamaño.
        </>
      ),
    },
    {
      id: 'ventana-corta',
      texto: (
        <>
          La ventana es corta por una razón concreta y no por descuido: el criterio de
          crecimiento necesita dos ejercicios anuales publicados, y la fuente gratuita da
          cuatro de los cuales el más antiguo llega sin beneficio neto. Antes de abril de 2024
          el screener no puede decidir nada. Con 28 meses de un solo régimen de mercado,
          ningún contraste alcanza significación: el t-stat es −0,69 frente al umbral
          convencional de 2,0.
        </>
      ),
    },
    {
      id: 'point-in-time',
      texto: (
        <>
          Lo que falta para cerrar la pregunta son{' '}
          <strong className="text-text-primary">fundamentales tal y como se conocían en cada
          fecha</strong> —los proveedores gratuitos solo dan los actuales, ya revisados— y la
          lista histórica de miembros del índice. El backtest acota el sesgo de supervivencia
          en un 8,9 % del universo en vez de ignorarlo, pero acotarlo no es eliminarlo.
        </>
      ),
    },
    {
      id: 'historial-vivo',
      texto: (
        <>
          En paralelo sigue corriendo el historial en vivo desde la primera recomendación
          guardada, visible en Portafolios y comparado contra el S&amp;P&nbsp;500. Es un
          registro real y sin retoques, y es la vía que no arrastra ningún sesgo de
          reconstrucción.
        </>
      ),
    },
  ],

  lectura: (
    <>
      Lectura recomendada para una decisión de capital: el proceso es
      <strong className="text-text-secondary"> auditable, reproducible y conservador en el tratamiento de los datos</strong>,
      y por eso el historial que produce es fiable como medida. Lo que aún no
      existe es la evidencia estadística de que el conjunto bata al índice.
      Dimensionar en consecuencia.
    </>
  ),
}
