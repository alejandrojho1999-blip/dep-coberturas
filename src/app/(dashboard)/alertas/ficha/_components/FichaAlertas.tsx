import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { SEVERIDAD_MINIMA_POR_DEFECTO } from '@/lib/alertas/dedupe'
import {
  Chip,
  ListaPuntos,
  NotaPie,
  Panel,
  TablaDatos,
  TablaScroll,
  Td,
  Th,
} from '@/app/(dashboard)/estrategias/_components/ui'

/**
 * Ficha técnica del sistema de alerta temprana.
 *
 * Documenta lo que la pantalla de `/alertas` enseña sin explicar: dónde corre
 * el motor, de dónde salen los datos, quién decide que algo es grave y qué no
 * sabe hacer. El contenido se escribe contra los módulos citados en cada
 * sección; cuando el código cambie, la ficha queda desmentida en voz alta en
 * vez de envejecer en silencio.
 */

interface Ciclo {
  nombre: string
  cadencia: string
  modulo: string
  porQue: string
}

const CICLOS: readonly Ciclo[] = [
  {
    nombre: 'Escalada Rusia–OTAN',
    cadencia: 'cada 2 min',
    modulo: 'motor.ts · cicloGuerra',
    porQue: 'Es el único que compite con el precio: una incursión se cotiza antes de que termine de escribirse la noticia.',
  },
  {
    nombre: 'Calendario de tasas',
    cadencia: 'cada 5 min',
    modulo: 'motor.ts · cicloCalendario',
    porQue: 'Avisa a 24 h, 1 h y 15 min, y dispara al publicarse el dato. La tolerancia de los hitos es de 5 minutos, así que este es el periodo máximo sin perder un aviso.',
  },
  {
    nombre: 'Pulso Fed vs Tesoro',
    cadencia: 'cada 15 min',
    modulo: 'motor.ts · cicloMacro',
    porQue: 'Declaraciones y comunicados. No se mueven tan rápido como un misil.',
  },
  {
    nombre: 'Pulso público',
    cadencia: 'cada 30 min',
    modulo: 'scripts/alertas · pulso',
    porQue: 'Media hora es el paso más fino con sentido —las tendencias de Google no se refrescan más rápido— y deja 48 lecturas al día. Solo mide y guarda: no envía nada ni llama al modelo.',
  },
  {
    nombre: 'Foto macro',
    cadencia: 'cada hora',
    modulo: 'motor.ts · cicloSnapshot',
    porQue: 'Guarda siempre; solo avisa a las 08:00 y 16:00 de Ecuador, o cuando la probabilidad de subida salta 10 puntos o más.',
  },
  {
    nombre: 'Palabras clave del día',
    cadencia: '06:10',
    modulo: 'scripts/alertas · keywords',
    porQue: 'Compara el recuento de hoy con la costumbre de las últimas cuatro semanas y hace juzgar al modelo los doce términos que más se salen. Es el único ciclo del pulso que cuesta llamadas al LLM, y por eso corre una vez y no cuarenta y ocho.',
  },
  {
    nombre: 'Reentrenamiento de las curvas',
    cadencia: '03:30',
    modulo: 'scripts/alertas · entrenar',
    porQue: 'Después de que cierren los mercados de ayer y antes de la primera lectura del día. Recalcula todo el histórico y solo pone en pie el modelo nuevo si mejora al vigente fuera de muestra.',
  },
  {
    nombre: 'Probabilidad del día',
    cadencia: '07:00',
    modulo: 'scripts/alertas · predecir',
    porQue: 'Con el modelo que esté activo. Sin modelo activo no escribe nada: la pantalla dice «calibrando» en vez de inventarse una cifra.',
  },
]

const FUENTES = [
  {
    familia: 'Titulares (RSS)',
    detalle: 'Google News para escalada Rusia–OTAN, artículo 4/5, flanco este, Kaliningrado y amenaza nuclear; feeds oficiales de la Reserva Federal (comunicados, política monetaria, discursos); el feed de IPC del BLS; y búsquedas sobre Warsh, Bessent y el FOMC.',
    modulo: 'src/lib/alertas/rss.ts',
  },
  {
    familia: 'Series macro (FRED)',
    detalle: 'EFFR para la tasa efectiva, M2SL, WALCL, DFII10 (tasa real 10 años), CPIAUCSL (inflación general) y CPILFESL (subyacente). Cada serie se pide por separado: una caída aislada no tumba el panel.',
    modulo: 'src/lib/data/fred.ts · src/lib/alertas/debasement.ts',
  },
  {
    familia: 'Precios de refugio',
    detalle: 'Oro (GC=F) y bitcoin (BTC-USD) por Yahoo Finance, siempre divididos entre M2. El panel no mira el precio nominal, mira el refugio por unidad de dinero impreso.',
    modulo: 'src/lib/alertas/precios.ts',
  },
  {
    familia: 'Probabilidad de tasas',
    detalle: 'Futuros de fondos federales con la metodología de CME FedWatch, para las probabilidades de subir, mantener y bajar en la próxima reunión.',
    modulo: 'src/lib/alertas/fedwatch.ts',
  },
  {
    familia: 'Atención pública',
    detalle: 'Seis fuentes cada media hora: búsquedas en tendencia, Hacker News, YouTube, volumen de noticias, visitas de Wikipedia y etiquetas de Mastodon.',
    modulo: 'src/lib/pulso/',
  },
]

export function FichaAlertas() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-brand text-lg font-extrabold uppercase tracking-[0.14em] text-text-primary">
              Ficha técnica · Alerta temprana
            </h1>
            <Chip tono="acento">solo admin</Chip>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-text-secondary">
            Cómo está construida la automatización que vigila la escalada Rusia–OTAN, el pulso
            entre la Reserva Federal y el Tesoro, la publicación de tasas y la atención pública.
            Qué mide, cada cuánto, con qué datos y con qué límites.
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
        titulo="Dónde corre y por qué ahí"
        descripcion="La decisión de arquitectura menos evidente del sistema, y la que más condiciona todo lo demás."
      >
        <TablaDatos
          filas={[
            {
              etiqueta: 'Planificador',
              valor: 'cron del propio servidor',
              nota: 'No es Vercel ni GitHub Actions. El puente de Nexus hacia WhatsApp solo escucha en 127.0.0.1: exponerlo a internet sería publicar un disparador de mensajes a nombre del administrador.',
            },
            {
              etiqueta: 'Por qué no Vercel',
              valor: 'su planificador no baja de resolución diaria',
              nota: 'El ciclo de guerra corre cada dos minutos. Una vez al día no es una alerta temprana, es un resumen.',
            },
            {
              etiqueta: 'Por qué no GitHub Actions',
              valor: 'arrastra varios minutos de retraso',
              nota: 'Aceptable para el archivo de cadenas, inaceptable para lo que compite con el precio.',
            },
            {
              etiqueta: 'Aplicación web',
              valor: 'Next.js 16 (App Router) en Vercel',
              nota: 'La pantalla /alertas es solo el registro de lo que el motor decidió. No dispara nada.',
            },
            {
              etiqueta: 'Almacenamiento',
              valor: 'Supabase',
              nota: 'alert_signals para las señales, macro_snapshots para la foto macro horaria, y las tablas del pulso público. El acceso desde el cron usa la clave de servicio.',
            },
            {
              etiqueta: 'Modelo de lenguaje',
              valor: 'OpenRouter · deepseek/deepseek-chat-v3-0324',
              nota: 'Clasifica titulares y juzga las palabras clave del día. No decide qué se envía: eso lo deciden umbrales de código.',
            },
          ]}
        />
        <NotaPie>
          La tabla de cron vive en <code>scripts/alertas/crontab.txt</code> con el porqué de cada
          periodo escrito al lado. El registro va a <code>/var/log/dep-alertas.log</code>, con
          rotación semanal a las últimas 5 000 líneas.
        </NotaPie>
      </Panel>

      <Panel
        titulo="Los ocho ciclos"
        descripcion="Cada uno corre por su cuenta. Regla común a todos: nada de lo que falle puede impedir el resto."
      >
        <TablaScroll>
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-border-subtle">
                <Th>Ciclo</Th>
                <Th>Cadencia</Th>
                <Th>Módulo</Th>
                <Th>Por qué ese ritmo</Th>
              </tr>
            </thead>
            <tbody>
              {CICLOS.map(c => (
                <tr key={c.nombre} className="border-b border-border-subtle last:border-0">
                  <Td className="font-semibold text-text-primary">{c.nombre}</Td>
                  <Td mono>{c.cadencia}</Td>
                  <Td mono className="text-text-muted">{c.modulo}</Td>
                  <Td className="whitespace-normal text-text-secondary">{c.porQue}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </TablaScroll>
      </Panel>

      <Panel
        titulo="De dónde salen los datos"
        descripcion="Ninguna fuente es de pago y ninguna es exclusiva. La ventaja no está en el dato, está en mirarlo cada dos minutos."
      >
        <TablaDatos
          filas={FUENTES.map(f => ({
            etiqueta: f.familia,
            valor: f.detalle,
            nota: f.modulo,
          }))}
        />
      </Panel>

      <Panel
        titulo="Cómo se decide que algo importa"
        descripcion="Del titular al mensaje hay tres filtros, y los tres pueden dejarlo fuera."
      >
        <TablaDatos
          filas={[
            {
              etiqueta: '1 · Severidad',
              valor: 'peldaños del 1 al 5, anclados en datos de mercado',
              nota: 'El clasificador no puntúa lo grave que suena el titular sino lo que movió el mercado en episodios comparables. La recalibración del 2026-09-02 reescribió los prompts con esas anclas empíricas porque el 60,9 % de las señales caía en los peldaños 4 y 5: si casi todo es urgente, nada lo es.',
            },
            {
              etiqueta: '2 · Deduplicación',
              valor: 'una clave de suceso por evento, no por titular',
              nota: 'Cinco medios contando lo mismo son un suceso, no cinco. Una severidad que no llega como número válido cae al suelo por defecto de ' + SEVERIDAD_MINIMA_POR_DEFECTO + ', para que un fallo de formato no ascienda un suceso menor.',
            },
            {
              etiqueta: '3 · Umbral de envío',
              valor: 'despacho silencioso por debajo del corte',
              nota: 'Lo que no llega al umbral se registra igual pero no se envía. La pantalla lo enseña; el WhatsApp no. Así el histórico sirve para calibrar sin gastar la atención del destinatario.',
            },
          ]}
        />
      </Panel>

      <Panel
        titulo="Cómo llega el aviso"
        descripcion="El último tramo, que es donde se rompen las cosas sin que nadie se entere."
      >
        <ListaPuntos
          puntos={[
            'El mensaje sale por el puente de Nexus hacia el WhatsApp del administrador, en local.',
            'El enlace de la noticia se acorta con is.gd para que quepa en una línea. Si el servicio tarda, responde mal o rechaza la URL, se manda la URL limpia: el aviso nunca se queda sin enlace por culpa del acortador.',
            'El registro distingue aceptado de entregado. Una señal encolada con la sesión de WhatsApp caída no llegó a ningún sitio, así que cuenta como fallida igual que una que el puente rechazó, y aparece en el KPI «No entregados».',
          ]}
        />
      </Panel>

      <Panel
        titulo="Las curvas de probabilidad"
        descripcion="La parte que aprende, y la única que puede callarse por diseño."
      >
        <ListaPuntos
          puntos={[
            'Cada madrugada se recalcula todo el histórico y se etiquetan los días cuya ventana de cinco sesiones ya cerró.',
            'El modelo nuevo solo sustituye al vigente si lo mejora fuera de muestra. Mejorar dentro de la muestra con la que se entrenó no significa nada.',
            'Sin modelo activo la pantalla dice «calibrando». Es deliberado: una cifra inventada se lee igual que una medida, y esa es exactamente la confusión que el sistema existe para evitar.',
          ]}
          tono="neutro"
        />
      </Panel>

      <Panel
        titulo="Lo que este sistema no sabe hacer"
        descripcion="Los límites conocidos. Están aquí para que nadie los descubra en el peor momento."
      >
        <ListaPuntos
          tono="aviso"
          puntos={[
            'No opera. No abre, cierra ni ajusta ninguna posición: avisa a una persona, que decide.',
            'No cubre fuentes de pago ni terminales profesionales. Si algo se publica primero en un servicio cerrado, este sistema se entera después.',
            'Solo lee titulares y resúmenes de RSS, no el cuerpo de la noticia. Un matiz que viva en el párrafo cuarto no se ve.',
            'La severidad la propone un modelo de lenguaje. Está anclada en datos de mercado y acotada por umbrales de código, pero sigue siendo un juicio, no una medición.',
            'La deduplicación agrupa por clave de suceso: si el modelo genera claves distintas para el mismo hecho, el mismo suceso puede avisar dos veces.',
            'Depende de un único servidor y de una sesión de WhatsApp. Si cualquiera de los dos cae, el sistema deja de avisar, y de eso solo se entera quien mire el KPI de no entregados.',
            'El calendario de publicaciones está escrito en el repositorio, no se descarga. Un cambio de fecha de última hora no se recoge solo.',
          ]}
        />
      </Panel>
    </div>
  )
}
