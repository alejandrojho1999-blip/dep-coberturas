import type { Ficha } from './tipos'

/**
 * Ficha del AGENTE GAMMA.
 *
 * Los umbrales están escritos a mano y deben seguir a su fuente si esta cambia:
 *   · paso 1      → bloque de candidatos y FALLBACK_TICKERS de `AgenteGamma.tsx`
 *   · paso 2      → cortes CALL/PUT de `AgenteGamma.tsx`; modelo en
 *                   `api/agentes/forecast/route.ts`
 *   · paso 3      → `lib/options/strategy-scoring.ts` y `lib/options/analyzer.ts`
 *   · paso 4      → filtro de calidad de `AgenteGamma.tsx`
 *   · paso 5      → `api/agentes/analyze/route.ts`
 *   · salida      → `lib/options/settle-picks.ts` y `lib/options/settlement.ts`
 */
export const FICHA_GAMMA: Ficha = {
  subtitulo: 'Qué compra, cuándo se cierra y cómo se pierde dinero',

  intro: (
    <>
      El <strong className="text-text-primary">Agente Gamma</strong>{' '}
      compra opciones direccionales: <strong className="text-text-primary">calls</strong>{' '}
      cuando espera subidas y <strong className="text-text-primary">puts</strong>{' '}
      cuando espera caídas. No busca empresas: parte de las que ya han
      seleccionado los agentes Peter y Small, y sobre ellas decide si existe un
      contrato que merezca la pena. Son cinco filtros en cascada, y conviene tener
      presente desde el principio que aquí{' '}
      <strong className="text-text-primary">se apuesta a la vez por la dirección y por el plazo</strong>:
      acertar el movimiento pero tarde pierde igual que equivocarse.
    </>
  ),

  pasos: [
    {
      n: '01',
      titulo: 'Candidatos',
      fuente: 'Picks vivos de Peter y Small',
      criterio: 'El universo son las posiciones abiertas de los otros dos agentes, sin duplicados. Solo si no hay ninguna se recurre a una lista de reserva de 15 valores grandes y muy líquidos escrita en el código.',
      umbral: 'Sin corte propio',
    },
    {
      n: '02',
      titulo: 'Dirección',
      fuente: 'Proyección a 30 días',
      criterio: 'La misma proyección que usan Peter y Small —regresión lineal sobre 60 cierres promediada 60/40 con una media exponencial— decide el sentido de la apuesta. Entre ambos cortes no se opera.',
      umbral: '≥ +2 % → CALL · ≤ −3 % → PUT',
    },
    {
      n: '03',
      titulo: 'Cadena de opciones',
      fuente: 'Contratos · Yahoo Finance',
      criterio: 'Se puntúan todos los contratos a menos del 25 % del precio actual y se elige el de mayor nota. La nota parte de 50 y premia liquidez, vencimiento entre 30 y 60 días, delta en zona útil y prima barata frente a su valor teórico; penaliza lo contrario.',
      umbral: 'Se toma el mejor',
    },
    {
      n: '04',
      titulo: 'Calidad del contrato',
      fuente: 'Filtro sobre el contrato elegido',
      criterio: 'El mejor contrato disponible puede seguir siendo malo, así que se le exigen tres cosas a la vez: sensibilidad al precio en zona intermedia, plazo suficiente para que la tesis se cumpla y una nota mínima.',
      umbral: '|Δ| 0,30–0,65 · 21–90 días · nota ≥ 50',
    },
    {
      n: '05',
      titulo: 'Revisión por IA',
      fuente: 'Modelo de lenguaje',
      criterio: 'Un modelo revisa el contrato y el subyacente y emite una convicción de 1 a 10. La dirección la fija el propio agente por la proyección, no el modelo.',
      umbral: 'Exige ≥ 7/10',
    },
  ],

  notaEmbudo: (
    <>
      Las griegas —delta, theta— no vienen dadas por el mercado: se calculan aquí
      con Black-Scholes a partir de la volatilidad implícita publicada. Son una
      estimación coherente, no un dato oficial, y por eso los datos de la cadena
      deben contrastarse en el bróker antes de operar de verdad.
    </>
  ),

  cuandoVende: (
    <>
      <strong className="text-text-primary">No hay venta anticipada.</strong>{' '}
      La posición se mantiene hasta el vencimiento del contrato, y ahí se liquida
      a su valor intrínseco contra el cierre real del subyacente ese día: lo que
      valdría ejercerla, sin más. El objetivo y el stop que se guardan junto a
      cada recomendación —dos veces y media la prima, y la mitad de la prima— son{' '}
      <strong className="text-text-primary">informativos: ningún proceso los vigila</strong>{' '}
      ni cierra la posición al tocarlos. Quien opere esto con dinero real y quiera
      un stop tiene que ponerlo en su bróker.
    </>
  ),

  garantias: [
    {
      titulo: 'La prima de entrada es siempre real',
      detalle: 'Se registra el punto medio entre la compra y la venta del contrato en ese momento. Si el mercado no publica horquilla ni cruce reciente, la recomendación se descarta en lugar de guardarse con una prima inventada.',
    },
    {
      titulo: 'El precio de referencia es el punto medio, no el último cruce',
      detalle: 'En contratos poco negociados el último cruce puede ser de hace días y estar muy lejos del precio al que se podría operar hoy. El punto medio de la horquilla es la referencia honesta.',
    },
    {
      titulo: 'Un contrato sin cotización se muestra en blanco',
      detalle: 'Si el mercado no publica precio para el contrato, la celda cae al guion en vez de rellenarse con una estimación teórica. Es preferible un hueco visible a una cifra que parece un dato y no lo es.',
    },
    {
      titulo: 'El resultado al vencimiento no se asume',
      detalle: 'Se busca el cierre real del subyacente el día de vencimiento y con él se calcula lo que valía el contrato. Si ese cierre no se puede obtener, la posición se deja abierta en vez de cerrarse con un resultado supuesto.',
    },
  ],

  riesgos: [
    {
      titulo: 'La pérdida máxima es el 100 % de la prima',
      detalle: (
        <>
          Una opción comprada que vence fuera de dinero no vale nada. No es el
          caso extremo poco probable: es{' '}
          <strong className="text-text-primary">el desenlace normal</strong>{' '}
          de una parte de las operaciones de cualquier estrategia de compra de
          opciones, y la rentabilidad del conjunto depende de que las acertadas
          compensen a las muchas que expiran sin valor.
        </>
      ),
    },
    {
      titulo: 'El tiempo juega en contra todos los días',
      detalle: 'Una opción comprada pierde valor con el mero paso del tiempo aunque el subyacente no se mueva. Acertar la dirección con el plazo equivocado es una pérdida, no un acierto parcial.',
    },
    {
      titulo: 'Sin stop y sin cierre anticipado',
      detalle: 'Como no hay venta antes del vencimiento, una posición que se va a cero lo hace entera. No existe el mecanismo de "cortar la pérdida" que sí tienen los agentes de acciones al re-evaluar sus filtros.',
    },
    {
      titulo: 'Los datos son de una fuente no oficial',
      detalle: 'La cadena de opciones se lee de un servicio público gratuito, no de un proveedor profesional. Antes de operar cualquier contrato hay que validar horquilla, liquidez y fechas de resultados en el bróker.',
    },
  ],

  validacion: [
    {
      id: 'sin-backtest',
      texto: (
        <>
          <strong style={{ color: 'var(--color-warning)' }}>Este agente no tiene backtest.</strong>{' '}
          Su respaldo hoy es el historial en vivo que se acumula desde la primera
          recomendación guardada, visible en la sección Portafolios. Es un registro
          real y sin retoques, pero todavía corto.
        </>
      ),
    },
    {
      id: 'sin-historico-primas',
      texto: (
        <>
          La dificultad aquí es distinta a la de los agentes de acciones y{' '}
          <strong className="text-text-primary">más severa</strong>: no existe
          histórico gratuito de primas de opciones. No se puede reconstruir a qué
          precio se habría comprado un contrato hace dos años, así que ni siquiera
          los filtros mecánicos son medibles hacia atrás sin pagar por datos.
        </>
      ),
    },
    {
      id: 'curva-escalonada',
      texto: (
        <>
          Por esa misma razón la curva de resultados del portafolio de opciones{' '}
          <em>avanza a saltos</em>: solo se mueve cuando una posición vence y se
          liquida. Se descartó suavizarla revaluando con Black-Scholes, porque sería
          una curva bonita pero teórica.
        </>
      ),
    },
  ],

  lectura: (
    <>
      Lectura recomendada para una decisión de capital: los backtests con
      validación walk-forward que hay en esta plataforma pertenecen a las seis
      estrategias de futuros sobre el Nasdaq, y{' '}
      <strong className="text-text-secondary">no dicen nada sobre este agente</strong>.
      Gamma es la apuesta más agresiva de las cuatro —máxima pérdida total,
      sin stop y sobre un activo que caduca—, así que el capital que se le asigne
      debe ser el que se pueda perder por completo.
    </>
  ),
}
