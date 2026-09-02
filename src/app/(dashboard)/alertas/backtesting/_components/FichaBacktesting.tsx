import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  ETIQUETA_TICKER,
  ETIQUETA_TRAMO,
  TICKERS_RESUMEN,
  eventoMovioElPrecio,
  lineaBase,
  movimientoDe,
  pctConSigno,
  perfilNormalidad,
  resumirGlobal,
  resumirPorClase,
  soloCurados,
  type EventoMedido,
} from '@/lib/alertas/backtesting'
import { UMBRAL_MATERIAL, VENTANA_JUICIO } from '@/lib/alertas/calibracion'
import {
  Chip,
  NotaPie,
  Panel,
  TablaScroll,
  Td,
  Th,
} from '@/app/(dashboard)/estrategias/_components/ui'

/**
 * Qué hizo el precio después de cada hecho del corpus.
 *
 * Esta pantalla existe para poder discutir la severidad con números delante. La
 * columna que importa no es la del oro sino la de «movió»: enseña los casos en
 * los que la etiqueta del analista y el mercado no coinciden, que son los que
 * corrigen el sistema.
 */

const SEMAFORO: Record<number, string> = { 1: '⚪', 2: '🟡', 3: '🟠', 4: '🔴', 5: '🚨' }

function Severidad({ valor }: { valor: number }) {
  return (
    <span className="whitespace-nowrap font-mono text-[11px]">
      {SEMAFORO[valor] ?? '⚪'} {valor}/5
    </span>
  )
}

/** Magnitud sin signo, para las columnas que describen un desplazamiento. */
function pctPlano(valor: number | null, decimales = 1): string {
  if (valor == null || !Number.isFinite(valor)) return '—'
  return `${(valor * 100).toFixed(decimales)}%`
}

/** Verde si el mercado se movió, apagado si no. El color es el dato. */
function Movio({ si }: { si: boolean }) {
  return si
    ? <span className="font-mono text-[11px] text-emerald-500">sí</span>
    : <span className="font-mono text-[11px] text-text-muted">no</span>
}

export function FichaBacktesting({ eventos }: { eventos: readonly EventoMedido[] }) {
  // El grupo de control se aparta de todo lo que se promedia: sus filas no son
  // hechos, y su severidad 1 no quiere decir «leve» sino «no hay nada que
  // puntuar». Mezclarlo haría mentir a cualquier media de esta pantalla.
  const curados = soloCurados(eventos)
  const global = resumirGlobal(curados)
  const porClase = resumirPorClase(curados)
  const base = lineaBase(eventos)
  const perfil = perfilNormalidad(eventos)

  // Los tramos no son comparables entre sí —el mercado de tasas cero reaccionaba
  // a la geopolítica de otra manera—, así que la tabla va separada por tramo y
  // no mezclada y ordenada por fecha.
  const tramos = [...new Set(curados.map((e) => e.tramo))]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-brand text-lg font-extrabold uppercase tracking-[0.14em] text-text-primary">
              Backtesting de eventos
            </h1>
            <Chip tono="acento">solo admin</Chip>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-text-secondary">
            Qué hizo de verdad el precio después de cada hecho histórico del patrón oro. Es el
            contraste con el que se corrige la severidad del clasificador: si la etiqueta dice 5
            y el mercado no se movió, manda el mercado.
          </p>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-text-muted">
            El sistema trabaja en cuatro pasos: el corpus mide qué hizo el precio tras cada hecho,
            el grupo de control mide qué hace en fechas al azar, el replay pregunta al clasificador
            qué peldaño le habría dado, y la curva traduce el peldaño del modelo al que el precio
            respalda. Lo que decide esa traducción no es la proporción bruta sino{' '}
            <strong className="text-text-secondary">lo que añade sobre la línea base</strong>: un
            peldaño que mueve el precio tanto como un martes cualquiera no vale nada, por grave que
            suene el titular.
          </p>
        </div>
        <Link
          href="/alertas"
          className="inline-flex items-center gap-2 rounded-md border border-border-subtle bg-surface px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="h-3 w-3" />
          Volver al registro
        </Link>
      </div>

      <Panel
        titulo="El corpus en cifras"
        descripcion="Los dos últimos números son los que valen: cada uno es un caso donde la etiqueta del analista y el mercado no coinciden."
      >
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { etiqueta: 'Eventos', valor: String(global.eventos) },
            { etiqueta: 'Mediciones', valor: String(global.mediciones) },
            { etiqueta: 'Movieron el precio', valor: `${global.movieron} de ${global.eventos}` },
            { etiqueta: 'Graves sin efecto', valor: String(global.gravesSinEfecto), acento: true },
            { etiqueta: 'Leves con efecto', valor: String(global.levesConEfecto), acento: true },
          ].map((c) => (
            <div key={c.etiqueta} className="rounded-lg border border-border-subtle bg-surface-raised p-3">
              <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">
                {c.etiqueta}
              </dt>
              <dd className={`mt-1 font-mono text-lg ${c.acento ? 'text-amber-500' : 'text-text-primary'}`}>
                {c.valor}
              </dd>
            </div>
          ))}
        </dl>
        <NotaPie>
          «Movió el precio» significa que al menos un activo vigilado superó su umbral en las{' '}
          {VENTANA_JUICIO} sesiones siguientes al cierre previo al hecho. Se juzga por el mayor
          desplazamiento de la ventana y no por el cierre final: lo que importa es si hubo susto
          en algún momento, no si el viernes ya se había deshecho.
        </NotaPie>
      </Panel>

      <Panel
        titulo="La línea base: qué hace el precio en un día cualquiera"
        descripcion="Sin esta cifra ninguna de las de arriba se puede interpretar. Si el mercado se mueve solo la mitad de los días, un peldaño que acierta el 60% no distingue casi nada."
      >
        {base ? (
          <>
            <p className="text-sm leading-relaxed text-text-secondary">
              En <strong className="font-mono text-text-primary">{base.n}</strong> fechas de sesión
              elegidas al azar, sin ningún hecho detrás, algún activo superó su umbral el{' '}
              <strong className="font-mono text-text-primary">{(base.base * 100).toFixed(1)}%</strong>{' '}
              de las veces. Esa es la cifra contra la que hay que leer cada peldaño: lo que un
              evento añade sobre ella es lo único que se puede llamar señal.
            </p>
            <NotaPie>
              Las fechas salen de un muestreo con semilla fija, así que el control no cambia entre
              ejecuciones y dos ajustes se pueden comparar. Se excluyen las sesiones a menos de diez
              días de un evento del corpus: una fecha pegada a la invasión de Ucrania no es un día
              corriente, mide la misma sacudida.
            </NotaPie>
          </>
        ) : (
          <p className="text-sm leading-relaxed text-amber-500">
            Todavía no hay grupo de control. Hasta que lo haya, las proporciones de arriba no se
            pueden interpretar y la curva de calibración no debe aplicarse: se construye con{' '}
            <code className="font-mono">npm run calibracion:placebo</code>.
          </p>
        )}
      </Panel>

      <Panel
        titulo="El día normal, activo por activo"
        descripcion="La línea base dice cuántas veces se mueve algo, pero no cuánto ni cuál. Esta tabla enseña la distribución de la que sale esa cifra, que es lo que permite ver a qué distancia queda un día corriente del umbral de un evento."
      >
        <TablaScroll>
          <table className="w-full min-w-[52rem] border-collapse">
            <thead>
              <tr className="border-b border-border-subtle">
                <Th>Activo</Th>
                <Th>Vota</Th>
                <Th alinear="right">Umbral</Th>
                <Th alinear="right">Mediana</Th>
                <Th alinear="right">p90</Th>
                <Th alinear="right">Máximo</Th>
                <Th alinear="right">Umbral / mediana</Th>
                <Th alinear="right">Cruza sin noticia</Th>
                <Th alinear="right">Cruza con noticia</Th>
                <Th alinear="right">Separación</Th>
              </tr>
            </thead>
            <tbody>
              {perfil.map((p) => (
                <tr key={p.ticker} className={`border-b border-border-subtle/60 ${p.vota ? '' : 'opacity-55'}`}>
                  <Td mono>{ETIQUETA_TICKER[p.ticker] ?? p.ticker}</Td>
                  <Td mono>
                    {p.vota
                      ? <span className="text-text-secondary">sí</span>
                      : <span className="text-text-muted">no cuenta</span>}
                  </Td>
                  <Td alinear="right" mono>{pctPlano(p.umbral, 0)}</Td>
                  <Td alinear="right" mono>{pctPlano(p.p50)}</Td>
                  <Td alinear="right" mono>{pctPlano(p.p90)}</Td>
                  <Td alinear="right" mono>{pctPlano(p.max)}</Td>
                  <Td alinear="right" mono>
                    {p.vecesLaMediana == null ? '—' : `×${p.vecesLaMediana.toFixed(1)}`}
                  </Td>
                  <Td alinear="right" mono>{p.n ? `${p.cruces} de ${p.n}` : '—'}</Td>
                  <Td alinear="right" mono>{p.nCurados ? `${p.crucesCurados} de ${p.nCurados}` : '—'}</Td>
                  <Td alinear="right" mono>
                    <span className={
                      p.separacion == null ? 'text-text-muted'
                        : p.separacion >= 0.15 ? 'text-emerald-500'
                          : 'text-amber-500'
                    }>
                      {p.separacion == null
                        ? '—'
                        : `${p.separacion >= 0 ? '+' : ''}${(p.separacion * 100).toFixed(0)} pts`}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </TablaScroll>
        <NotaPie>
          Las tres primeras columnas describen el desplazamiento del activo en {VENTANA_JUICIO}{' '}
          sesiones <strong>sin</strong> ningún hecho detrás; en el VIX solo cuenta la subida, porque
          un desplome es el mercado calmándose y no un susto. «Separación» es cuánto más cruza el
          umbral con noticia que sin ella, y es la única columna que dice si el activo sirve: se
          compara en tasa y no en cuenta porque los dos grupos no tienen el mismo tamaño. Un activo
          cerca de cero cruza igual pase o no pase algo y, como basta con que <strong>uno</strong>{' '}
          cruce para dar por movido el precio, arrastra el veredicto sin aportar información. Los
          activos marcados «no cuenta» se siguen midiendo y enseñando, pero no deciden: el Nasdaq
          salió del veredicto el 2026-09-03 porque correlaciona 0,82 con el S&amp;P —es el mismo
          índice contado dos veces— y sus únicos cruces sin noticia son de 2002 y 2003, la resaca
          de las puntocom. La decisión de quitar un activo no se toma con esta columna sino con su
          aportación al criterio completo: el oro y el dólar separan poco por su cuenta y aun así
          se quedan, porque nunca cruzan solos y retirarlos no cambiaría ni una fila.
        </NotaPie>
      </Panel>

      <Panel
        titulo="Qué mueve cada familia de suceso"
        descripcion="La pregunta útil no es cuánto movió este dron, sino cuánto mueve un dron en general. Una incursión es una anécdota; cuatro son una expectativa."
      >
        <TablaScroll>
          <table className="w-full min-w-[46rem] border-collapse">
            <thead>
              <tr className="border-b border-border-subtle">
                <Th>Familia</Th>
                <Th alinear="right">Casos</Th>
                <Th alinear="right">Severidad media</Th>
                <Th alinear="right">Movieron</Th>
                <Th alinear="right">Oro (media)</Th>
                <Th alinear="right">VIX (extremo medio)</Th>
              </tr>
            </thead>
            <tbody>
              {porClase.map((c) => (
                <tr key={c.clase} className="border-b border-border-subtle/60">
                  <Td mono>{c.clase}</Td>
                  <Td alinear="right" mono>{c.n}</Td>
                  <Td alinear="right" mono>{c.severidadMedia.toFixed(1)}</Td>
                  <Td alinear="right" mono>{c.movieron} de {c.n}</Td>
                  <Td alinear="right" mono>{pctConSigno(c.oroMedio)}</Td>
                  <Td alinear="right" mono>{pctConSigno(c.vixExtremoMedio)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </TablaScroll>
        <NotaPie>
          Con {global.eventos} eventos repartidos en {porClase.length} familias, las que tienen uno
          o dos casos son anécdotas y no expectativas. La tabla va ordenada por número de casos
          para que se vea de un vistazo cuáles tienen respaldo.
        </NotaPie>
      </Panel>

      {tramos.map((tramo) => {
        const delTramo = eventos.filter((e) => e.tramo === tramo)
        return (
          <Panel
            key={tramo}
            titulo={ETIQUETA_TRAMO[tramo] ?? tramo}
            descripcion={`${delTramo.length} eventos. Retornos a ${VENTANA_JUICIO} sesiones desde el cierre previo al hecho; el VIX se da por su mayor desplazamiento.`}
          >
            <TablaScroll>
              <table className="w-full min-w-[52rem] border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle">
                    <Th>Fecha</Th>
                    <Th>Hecho</Th>
                    <Th alinear="right">Severidad</Th>
                    {TICKERS_RESUMEN.map((t) => (
                      <Th key={t} alinear="right">{ETIQUETA_TICKER[t] ?? t}</Th>
                    ))}
                    <Th alinear="right">¿Movió?</Th>
                  </tr>
                </thead>
                <tbody>
                  {[...delTramo].sort((a, b) => a.fecha.localeCompare(b.fecha)).map((e) => (
                    <tr key={`${e.fecha}-${e.titulo}`} className="border-b border-border-subtle/60 align-top">
                      <Td mono>{e.fecha}</Td>
                      <Td>
                        <span className="block max-w-md text-xs leading-relaxed">{e.titulo}</span>
                        <span className="mt-0.5 block font-mono text-[10px] text-text-muted">
                          {e.clase} · {e.tema}
                        </span>
                      </Td>
                      <Td alinear="right"><Severidad valor={e.severidad} /></Td>
                      {TICKERS_RESUMEN.map((t) => {
                        const m = movimientoDe(e, t)
                        // Del VIX interesa el extremo: es un índice de miedo y lo
                        // que dice algo es el pico, no dónde acabó la semana.
                        const valor = t === '^VIX' ? m?.extremo ?? null : m?.retorno ?? null
                        return (
                          <Td key={t} alinear="right" mono>{pctConSigno(valor)}</Td>
                        )
                      })}
                      <Td alinear="right"><Movio si={eventoMovioElPrecio(e)} /></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TablaScroll>
          </Panel>
        )
      })}

      <Panel
        titulo="Umbrales: cuándo se considera que un activo se movió"
        descripcion="No son iguales porque los activos no lo son: un 3% en el oro es un día histórico y en Bitcoin es un martes cualquiera."
      >
        <TablaScroll>
          <table className="w-full min-w-[28rem] border-collapse">
            <thead>
              <tr className="border-b border-border-subtle">
                <Th>Activo</Th>
                <Th>Símbolo</Th>
                <Th alinear="right">Umbral</Th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(UMBRAL_MATERIAL).map(([ticker, umbral]) => (
                <tr key={ticker} className="border-b border-border-subtle/60">
                  <Td>{ETIQUETA_TICKER[ticker] ?? ticker}</Td>
                  <Td mono>{ticker}</Td>
                  <Td alinear="right" mono>{(umbral * 100).toFixed(1)}%</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </TablaScroll>
        <NotaPie>
          Del VIX solo cuenta la subida. Es un índice de miedo: que suba un 30% es un susto y que
          baje un 30% es el mercado calmándose. Para el resto cuenta el desplazamiento en
          cualquier dirección, porque una posición cubierta se comporta distinto igual.
        </NotaPie>
      </Panel>

      <Panel
        titulo="Qué NO se puede concluir de esta tabla"
        descripcion="El corpus tiene un sesgo conocido y de él depende que la curva de corrección todavía no se aplique."
      >
        <div className="space-y-3 text-xs leading-relaxed text-text-secondary">
          <p>
            <strong className="text-text-primary">Todos los eventos de aquí fueron elegidos por
            haber sido importantes.</strong> Faltan los días corrientes, que son la inmensa mayoría
            de las señales reales. Por eso la probabilidad de movimiento sale altísima en todos los
            peldaños y la curva de calibración acaba <em>subiendo</em> la severidad en vez de
            bajarla, que es lo contrario de lo que se busca. Hasta que el corpus tenga
            treinta o cincuenta hechos anodinos, estas filas son un registro de lo medido y no
            una tabla lista para producción.
          </p>
          <p>
            <strong className="text-text-primary">Correlación no es causa.</strong> El
            desplazamiento se mide en la ventana siguiente al hecho, pero nada garantiza que lo
            causara el hecho. En junio de 2022 el Bitcoin cayó un 20% en la ventana de una decisión
            de la Fed, y lo que lo hundía era el colapso de Celsius.
          </p>
          <p>
            <strong className="text-text-primary">Los tres tramos no se comparan entre sí.</strong>{' '}
            El mercado de tasas cero reaccionaba a la geopolítica de otra manera. Los tramos de
            control existen para decir si las anclas del tramo principal son un accidente del
            régimen actual o algo más estable.
          </p>
        </div>
        <NotaPie>
          Datos de <code className="font-mono">severity_events</code> y{' '}
          <code className="font-mono">severity_event_moves</code>. Se cargan a mano con{' '}
          <code className="font-mono">npm run calibracion:medir</code> y{' '}
          <code className="font-mono">calibracion:cargar</code>; ningún cron los toca. El patrón oro
          vive en <code className="font-mono">scripts/calibracion/eventos.ts</code>, que es donde se
          revisa cada severidad con el resto del código.
        </NotaPie>
      </Panel>
    </div>
  )
}
