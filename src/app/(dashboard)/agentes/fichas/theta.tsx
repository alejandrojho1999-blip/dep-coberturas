import Link from 'next/link'
import type { Ficha } from './tipos'

/**
 * Ficha del AGENTE THETA.
 *
 * Los umbrales están escritos a mano y deben seguir a su fuente si esta cambia:
 *   · paso 1      → THETA_UNIVERSE de `AgenteTheta.tsx`
 *   · paso 2      → cortes de seguridad de `AgenteTheta.tsx`; modelo en
 *                   `api/agentes/forecast/route.ts`
 *   · paso 3      → `lib/options/strategy-scoring.ts` y `lib/options/analyzer.ts`
 *   · paso 4      → filtro de calidad de prima de `AgenteTheta.tsx`
 *   · paso 5      → `api/agentes/analyze/route.ts`
 *   · salida      → `lib/options/settle-picks.ts` y `lib/options/settlement.ts`
 *   · capital     → `lib/portafolios/positions.ts`
 */
export const FICHA_THETA: Ficha = {
  subtitulo: 'Qué vende, cuándo se cierra y cómo se pierde dinero',

  intro: (
    <>
      El <strong className="text-text-primary">Agente Theta</strong>{' '}
      hace lo contrario que el Gamma:{' '}
      <strong className="text-text-primary">vende opciones y cobra la prima</strong>{' '}
      por adelantado. Vende puts sobre valores que no espera que se desplomen y
      calls cubiertas sobre valores que no espera que se disparen. Gana cuando no
      pasa nada, que es lo que suele pasar. La contrapartida define el perfil
      entero:{' '}
      <strong className="text-text-primary">gana poco muchas veces y puede perder mucho pocas veces</strong>.
    </>
  ),

  pasos: [
    {
      n: '01',
      titulo: 'Universo fijo',
      fuente: '36 valores e índices',
      criterio: 'Una lista escrita a mano en el código: grandes valores, ETFs de índice y de sector, elegidos por tener mercados de opciones activos. No hay filtro automático de liquidez a este nivel; la liquidez se comprueba después, contrato a contrato.',
      umbral: 'Lista cerrada',
    },
    {
      n: '02',
      titulo: 'Filtro de seguridad',
      fuente: 'Proyección a 30 días',
      criterio: 'La proyección decide qué lado tiene sentido: vender puts si no se anticipa una caída fuerte, vender calls cubiertas si no se anticipa una subida fuerte. Casi siempre al menos una de las dos es viable, así que en la práctica este paso descarta sobre todo los valores sin datos suficientes.',
      umbral: 'Put ≥ −5 % · Call ≤ +8 %',
    },
    {
      n: '03',
      titulo: 'Cadena de opciones',
      fuente: 'Contratos · Yahoo Finance',
      criterio: 'Se puntúan los contratos de ambas estrategias y se elige el de mayor nota. Al vender, la nota premia lo contrario que al comprar: prima cara frente a su valor teórico, buena liquidez y un strike alejado del precio actual.',
      umbral: 'Se toma el mejor',
    },
    {
      n: '04',
      titulo: 'Calidad de la prima',
      fuente: 'Filtro sobre el contrato elegido',
      criterio: 'Cuatro exigencias a la vez: volatilidad alta —sin ella la prima no compensa el riesgo—, plazo corto para que el tiempo corra a favor, probabilidad de acabar dentro de dinero contenida, y una nota mínima.',
      umbral: 'IV > 30 % · 21–45 días · |Δ| 0,15–0,35 · nota ≥ 60',
    },
    {
      n: '05',
      titulo: 'Revisión por IA',
      fuente: 'Modelo de lenguaje',
      criterio: 'Un modelo revisa el contrato y el subyacente y emite una convicción de 1 a 10. La estrategia ya está decidida por los pasos anteriores; el modelo solo puede vetarla.',
      umbral: 'Exige ≥ 7/10',
    },
  ],

  notaEmbudo: (
    <>
      El delta entre 0,15 y 0,35 es el corazón del método: es, aproximadamente, la
      probabilidad de que el contrato acabe costando dinero.{' '}
      <strong className="text-text-secondary">Vender con delta 0,20 significa aceptar perder en torno a una de cada cinco veces</strong>,
      y confiar en que las cuatro restantes lo compensen. Que eso ocurra depende
      de que la prima cobrada sea suficiente, no de acertar la dirección.
    </>
  ),

  cuandoVende: (
    <>
      Cada posición lleva dos niveles calculados sobre la prima cobrada:{' '}
      <strong className="text-text-primary">
        recompra en la mitad de la prima
      </strong>{' '}
      —el objetivo— y{' '}
      <strong className="text-text-primary">stop en el doble de la prima</strong>,
      o sea al perder una vez lo cobrado. Se recompra al 50 % porque a partir de
      ahí queda poco por ganar y sigue en riesgo todo lo que puede perderse: es
      el tramo con peor relación entre una cosa y la otra, y devolverlo al
      mercado libera el capital para la siguiente venta. Son las dos órdenes que
      hay que dejar puestas en el bróker. Cuando el agente se ejecuta pide la
      prima viva de cada contrato abierto y cierra en el registro el que ya haya
      tocado un nivel, dando por hecho que la orden saltó sola en la cuenta.{' '}
      <strong className="text-text-primary">
        Entre una ejecución y la siguiente no vigila nadie
      </strong>
      : esto no es un stop automático, es una revisión al ejecutar. Lo que no
      toca ningún nivel se mantiene hasta el vencimiento: si vence sin valor la
      prima es beneficio íntegro, y si vence dentro de dinero el resultado puede
      ser una pérdida mayor que todo lo cobrado.
    </>
  ),

  garantias: [
    {
      titulo: 'La prima cobrada es siempre real',
      detalle: 'Se registra el punto medio entre compra y venta del contrato en ese momento, no el último cruce, que en contratos poco negociados puede ser de días atrás.',
    },
    {
      titulo: 'Vencer dentro de dinero no cuenta como acierto',
      detalle: 'El resultado se calcula contra el cierre real del subyacente el día del vencimiento. Hubo un error que daba por buena la prima entera en todos los vencimientos, y esa es exactamente la ilusión que este cálculo evita.',
    },
    {
      titulo: 'El capital comprometido es el colateral, no la prima',
      detalle: 'Un put vendido inmoviliza el dinero necesario para comprar las acciones si se ejerce, y así se contabiliza en el portafolio. Medirlo por la prima haría parecer diminuta la estrategia que más capital retiene de las cuatro.',
    },
    {
      titulo: 'Los umbrales están fijados en el código',
      detalle: 'Ninguno se ajusta sobre la marcha ni depende del criterio del operador. Cambiar uno exige modificar el código y queda en el historial de versiones.',
    },
  ],

  riesgos: [
    {
      titulo: 'El beneficio está limitado y la pérdida no lo está en la misma medida',
      detalle: (
        <>
          Lo máximo que se puede ganar en cada operación es la prima cobrada. Lo
          que se puede perder es{' '}
          <strong className="text-text-primary">muchas veces esa cantidad</strong>{' '}
          si el subyacente se mueve en contra. Es el reparto de resultados
          opuesto al del Agente Gamma.
        </>
      ),
    },
    {
      titulo: 'Un put vendido puede acabar en asignación',
      detalle: 'Si el valor cae por debajo del strike, el vendedor está obligado a comprar 100 acciones por contrato al precio pactado, esté donde esté el mercado. Hay que tener el efectivo para ello: la pérdida máxima es el strike menos la prima cobrada, por acción.',
    },
    {
      titulo: 'La call cubierta da por supuesto que se poseen las acciones',
      detalle: 'La estrategia solo es "cubierta" si quien la ejecuta ya tiene las 100 acciones por contrato. El sistema no comprueba en ningún momento que sea así. Vendida sin tenerlas, la operación cambia de naturaleza y su pérdida deja de estar acotada.',
    },
    {
      titulo: 'Muchas ganancias pequeñas esconden mal el riesgo',
      detalle: 'Una racha larga de vencimientos sin valor produce un historial de aspecto excelente y una sensación de seguridad que no corresponde al riesgo asumido. La medida honesta de esta estrategia no es el porcentaje de aciertos, sino qué ocurre en el peor mes.',
    },
  ],

  validacion: [
    {
      id: 'backtest-hecho',
      texto: (
        <>
          <strong className="text-text-primary">Este agente ya tiene backtest</strong>, sobre 254
          vencimientos y 21 años, medido contra <span className="font-mono">^PUT</span> —el índice
          PutWrite del CBOE, que vende puts sobre el S&amp;P 500 de forma mecánica—. Es la
          comparación justa: medirlo contra el SPY compararía vender opciones con comprar acciones.{' '}
          <Link href="/agentes/backtest" className="underline underline-offset-2 hover:text-text-primary">
            Ver el backtest completo
          </Link>.
        </>
      ),
    },
    {
      id: 'no-bate-su-indice',
      texto: (
        <>
          <strong style={{ color: 'var(--color-warning)' }}>El resultado no respalda al agente.</strong>{' '}
          Con el supuesto calibrado rinde un <strong className="text-text-primary">3,84 % anual
          frente al 7,78 % de <span className="font-mono">^PUT</span></strong>, con{' '}
          <em>information ratio</em> −0,31. El signo se repite en las tres corridas que no arruinan
          la cartera. Seleccionar 36 subyacentes no mejora a vender puts sobre el índice sin
          seleccionar nada.
        </>
      ),
    },
    {
      id: 'niveles-evitan-ruina',
      texto: (
        <>
          <strong className="text-text-primary">Los niveles de salida son lo que impide la
          ruina.</strong> Sin ellos la cartera llega a cero: pierde el 100 %. Vender opciones puede
          costar mucho más que la prima cobrada, y cuando el subyacente se desploma la obligación de
          recomprar supera la caja. Con los niveles activos sobrevive los 21 años con una caída
          máxima del 26 %. Es el argumento más fuerte a favor de la revisión de niveles que se
          implementó en agosto de 2026.
        </>
      ),
    },
    {
      id: 'primas-reconstruidas',
      texto: (
        <>
          Las primas están reconstruidas con Black-Scholes: no hay histórico gratuito de cadenas de
          opciones. El supuesto de volatilidad se calibra replicando{' '}
          <span className="font-mono">^PUT</span> con correlación 0,94, pero conviene saber en qué
          dirección empuja: <strong className="text-text-primary">cuanto más caras se suponen las
          primas, mejor sale Theta</strong>, porque su ventaja <em>es</em> vender caro. Por eso el
          informe publica el resultado como curva sobre el supuesto y no como una cifra.
        </>
      ),
    },
    {
      id: 'sin-significacion',
      texto: (
        <>
          El corte de score ≥ 60 no se reproduce: pondera sobre todo el interés abierto y el volumen
          de cada contrato, que no existen hacia atrás. Tampoco el paso de revisión por IA. Y en 49
          de los 254 vencimientos el agente no encontró ningún contrato que pasara sus filtros.
        </>
      ),
    },
  ],

  lectura: (
    <>
      Lectura recomendada para una decisión de capital: los backtests con
      validación walk-forward de esta plataforma son de las seis estrategias de
      futuros sobre el Nasdaq y{' '}
      <strong className="text-text-secondary">no dicen nada sobre este agente</strong>.
      Theta es la estrategia que mejor aspecto tiene en el corto plazo y la que
      más capital inmoviliza; juzgarla por su racha de aciertos, sin haber visto
      todavía una caída fuerte, sería el error más caro que permite esta
      plataforma.
    </>
  ),
}
