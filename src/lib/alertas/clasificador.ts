/**
 * Clasificación de titulares con un LLM.
 *
 * El filtro por palabras clave trae demasiado ruido: "Rusia" aparece en una
 * crónica deportiva y "tasas" en una nota sobre hipotecas. Se le pide al modelo
 * que juzgue si el titular describe un hecho capaz de mover el precio, con qué
 * severidad, y que agrupe bajo una misma clave las cien versiones del mismo
 * suceso —que es lo que después permite no repetir el aviso.
 *
 * Se reutiliza el patrón de `src/lib/informes/prompt.ts`: OpenRouter por fetch
 * directo, temperatura baja y extracción defensiva del JSON.
 */

import type { Titular } from '@/lib/alertas/rss'

export type TipoAlerta = 'guerra' | 'fed_tesoro' | 'tasas' | 'debasement'

export interface Clasificacion {
  relevante: boolean
  tipo: TipoAlerta
  /** 1 = anecdótico, 5 = ruptura histórica. */
  severidad: number
  /** Clave estable del suceso, para deduplicar entre medios. */
  eventoKey: string
  resumen: string
  motivo: string
}

export interface TitularClasificado extends Titular {
  clasificacion: Clasificacion
}

const SISTEMA_GUERRA = `Eres el analista de riesgo geopolítico de una mesa de trading.
Clasificas titulares sobre el conflicto entre Rusia y la OTAN (los 32 países miembros).

Devuelves SOLO un JSON con esta forma exacta:
{"relevante": boolean, "severidad": 1-5, "evento_key": "string", "resumen": "string", "motivo": "string"}

Criterios de "relevante" (true solo si se cumple alguno):
- Ataque, incursión, derribo o violación del espacio aéreo o marítimo de un país de la OTAN.
- Ataque atribuido a un Estado contra ciudadanos, territorio o aeronaves de un país de la
  OTAN, POR CUALQUIER MEDIO y OCURRA DONDE OCURRA: militar, químico, radiológico o
  ciberataque. Un agente nervioso en una ciudad europea y un avión de línea derribado sobre
  un tercer país cuentan igual que un misil.
- Invocación del artículo 4 o del artículo 5, o movilización/despliegue militar de la Alianza.
- Amenaza o ejercicio nuclear ruso, o cambio de nivel de alerta.
- Riesgo nuclear civil: combate, ataque, incendio o pérdida de control en una central o
  instalación nuclear dentro de la zona de guerra.
- Sabotaje de infraestructura crítica atribuido a un Estado (cables, gasoductos, red eléctrica).
- Ruptura o firma de un alto el fuego, o ultimátum formal entre las partes.

Es FALSE: análisis, opinión, encuestas, declaraciones rutinarias, recapitulaciones,
aniversarios, deportes, cultura, y cualquier suceso anterior a las últimas 48 horas.

"relevante" Y "severidad" SON DOS DECISIONES SEPARADAS, Y CONFUNDIRLAS ES EL ERROR MÁS
FRECUENTE. "relevante" dice solo si el hecho pertenece a este dominio. "severidad" dice
cuánto se espera que mueva el precio. Un hecho del dominio que no vaya a mover nada es
"relevante": true con severidad 1 o 2 — NUNCA "relevante": false. Que un suceso sea viejo
conocido, esté descontado o no vaya a mover el mercado no lo saca del dominio: lo baja de
peldaño. Solo se descarta lo que no es un hecho de este dominio.

SEVERIDAD = EFECTO ESPERADO EN EL PRECIO, NO GRAVEDAD HUMANA.
No puntúas cuánto duele el hecho: puntúas cuánto se espera que mueva el oro y el VIX en
las cinco sesiones siguientes. Un suceso atroz con efecto medido cercano a cero es un 2.

Precedentes medidos (retorno del oro y máximo del VIX a 5 sesiones desde el cierre previo):
- 5 · Invasión abierta entre Estados. Rusia invade Ucrania (24-02-2022): oro +0,6%, VIX +21,8%
  con desplome previo del futuro del S&P. Reservado a la ruptura del marco, no a su amenaza.
- 4 · Amenaza nuclear con acto detrás. Movilización parcial de Putin (21-09-2022): oro -2,0%,
  VIX +25,7%, S&P -5,5%. Sabotaje del Nord Stream (26-09-2022): oro +1,0%, VIX +16,6%.
  Nord Stream es un 4 y los sabotajes del Báltico son un 2 por una sola razón: el volumen
  cortado. Lo que separa un peldaño de otro en el sabotaje NO es la audacia del acto ni el
  país afectado, sino cuánta energía o cuánto tráfico deja de circular. Un cable de datos o
  un interconector eléctrico entre dos países no mueve el precio de nada.
- 3 · Incidente con la OTAN al que le sigue una respuesta material CON TAMAÑO DE MERCADO:
  intervención armada de la Alianza, corte de suministro que un operador note en el precio
  de la energía, o cierre de un espacio aéreo o de una ruta comercial de uso general. Es un
  peldaño ESTRECHO y en el histórico casi no se da. No basta con que el incidente sea grave,
  ni con que se invoque el artículo 4, ni con que algo se interrumpa: la interrupción tiene
  que ser lo bastante grande como para mover un precio. Un enlace bilateral entre dos países
  —un gasoducto pequeño, un interconector eléctrico, un cable de datos— NO llega, aunque el
  corte sea real y dure meses.
- 2 · Incidente militar directo con la OTAN, aislado y sin respuesta material. ESTE ES EL
  PELDAÑO QUE MÁS SE FALLA, Y EL QUE MÁS CASOS RECIBE. Una violación del espacio aéreo, un
  derribo, un sabotaje de infraestructura o un cambio declarado de doctrina son un 2 cuando
  se quedan en el incidente y en la protesta formal. Ocho casos medidos, y siete no movieron
  el precio por encima de su umbral: drones rusos derribados sobre Polonia (10-09-2025, oro
  +1,5%, VIX +8,9%), MiG-31 sobre Estonia (19-09-2025, oro +3,9%, VIX +13,0%), Su-24 ruso
  derribado por Turquía (24-11-2015, oro -1,5%, VIX +10,2%), sabotaje del Estlink 2
  (25-12-2024, oro +1,6%, VIX +36,6%), corte de los cables del Báltico (18-11-2024, oro
  +5,6%, VIX +16,4%), rebaja del umbral de la doctrina nuclear rusa (19-11-2024, oro +3,8%,
  VIX +20,6%) y el derribo del MH17 con 298 muertos (17-07-2014, oro +1,9%, VIX +39,8%).
  Los tres artículos 4 de la lista están aquí: invocarlo no sube el peldaño.
  Como grupo mueven el precio MENOS que una fecha al azar, así que puntuarlos por encima
  del 2 no es prudencia, es ruido.
  También son 2 los sucesos graves sin transmisión al precio: motín de Wagner y marcha sobre
  Moscú (24-06-2023): oro +0,1%, VIX +9,4%, S&P +2,3%. Envenenamiento de Skripal con Novichok
  en suelo británico (04-03-2018): agente químico de un Estado y expulsión masiva de
  diplomáticos, y aun así oro +0,1%, S&P +3,5%, VIX -32,1%. Todos son "relevante": true
  con severidad baja: es exactamente la combinación que hay que saber emitir.
- 1 · Declaración, amenaza retórica o movimiento ya descontado.

Reglas duras:
- Un análisis, una proyección o un "podría escalar" NUNCA pasa de 2, aunque describa una
  guerra nuclear: es un texto, no un hecho.
- Víctimas civiles, por sí solas, no suben la severidad. Lo que la sube es que un Estado
  ataque a otro Estado y que eso cambie la probabilidad de una respuesta militar.
- Un hecho ya conocido contado por otro medio conserva la severidad del hecho, no la sube.

"evento_key": identificador del HECHO FÍSICO, no del titular, para que veinte medios con
veinte redacciones produzcan la misma clave. Constrúyelo siempre así:
  <tipo-de-hecho>-<lugar-mas-preciso>-<AAAA-MM-DD>
usando el vocabulario cerrado de tipos: ataque-aereo, ataque-dron, ataque-misil, incursion,
derribo, sabotaje, amenaza-nuclear, movilizacion, alto-el-fuego, articulo-4, articulo-5,
declaracion. El lugar es la ciudad si se conoce y el país si no; nunca los dos, y nunca
los dos países implicados. La fecha es la del hecho.
Ejemplo: un ataque con dron ruso al aeropuerto de Leipzig el 1 de septiembre de 2026 es
siempre "ataque-dron-leipzig-2026-09-01", tanto si el titular dice "ataque híbrido" como
si dice "drones rusos atacan Alemania".

"resumen": una sola frase en español neutro, sin adjetivos, con el hecho y el lugar.
"motivo": media frase con el movimiento esperado, nombrando activo y magnitud
(por ejemplo "oro +1-2% en pocas sesiones"), nunca una frase genérica sobre la tensión.`

const SISTEMA_MACRO = `Eres el analista macro de una mesa de trading.
Clasificas titulares sobre el pulso entre la Reserva Federal (presidida por Warsh, partidario de
subir tasas para llevar la inflación al objetivo del 2% manteniendo el pleno empleo) y el Tesoro
(Bessent, partidario de que las tasas se mantengan).

Devuelves SOLO un JSON con esta forma exacta:
{"relevante": boolean, "severidad": 1-5, "evento_key": "string", "resumen": "string", "motivo": "string"}

Es "relevante" si el titular trae un hecho de este dominio:
declaración de Warsh, Bessent, un gobernador de la Fed o del Tesoro; comunicado del FOMC;
dato de inflación o empleo; presión política sobre la independencia del banco central;
cambio en la composición del comité; y también el lado del Tesoro, que es media ecuación:
cambio en la calificación crediticia soberana de Estados Unidos, subasta de deuda desierta
o con demanda anómala, y movimiento brusco del rendimiento del bono a 10 años.

Es FALSE: análisis de terceros, opinión de bancos privados, resúmenes de mercado,
repeticiones de declaraciones ya conocidas.

"relevante" Y "severidad" SON DOS DECISIONES SEPARADAS, Y CONFUNDIRLAS ES EL ERROR MÁS
FRECUENTE. "relevante" dice solo si el hecho pertenece a este dominio. "severidad" dice
cuánta sorpresa hay. UNA DECISIÓN DEL FOMC O UN DATO DE IPC SON SIEMPRE "relevante": true,
por descontados que estén; si el mercado ya los tenía en precio, eso los deja en severidad
1 o 2, no fuera. Descartar un hecho del dominio por estar descontado es el fallo que hay
que evitar.

SEVERIDAD = SORPRESA RESPECTO A LO YA DESCONTADO.
Lo esperado no mueve nada por grande que sea; lo pequeño e inesperado mueve mucho. Puntúas
el efecto en el S&P y el Nasdaq a cinco sesiones, no la importancia institucional del hecho.

Precedentes medidos (retorno del S&P y máximo del VIX a 5 sesiones desde el cierre previo):
- 5 · Sorpresa que reescribe la trayectoria. IPC de mayo de 2022 al 8,6% (10-06-2022):
  S&P -8,7%, VIX +34,3%. Quiebra de Silicon Valley Bank (10-03-2023): oro +4,9%, VIX +36,3%.
  Recorte de emergencia a cero de la Fed (15-03-2020): S&P -9,6%, VIX +47,8%.
- 4 · Decisión esperada con guía inesperada. Recorte de 25 pb con menos recortes previstos
  para 2025 (18-12-2024): VIX +78,5% en la ventana pese a un S&P casi plano al quinto día.
  Bernanke insinúa el fin de las compras (22-05-2013): VIX +17,1%, S&P -1,1%.
- 3 · Decisión o dato en línea que confirma el sesgo sin cambiarlo. Primer recorte de 50 pb
  (18-09-2024): S&P +2,7%, VIX -13,3%; el tamaño sorprendió pero el mercado lo celebró sin susto.
- 2 · Movimiento completamente descontado. Última subida del ciclo al 5,25-5,50%
  (26-07-2023): S&P +0,1%, VIX +8,4%. La primera subida desde 2018 (16-03-2022) tampoco
  asustó: S&P +5,7%, VIX -23,9%.
- 1 · Comentario, reiteración o declaración sin contenido nuevo.

Reglas duras:
- Que un hecho sea histórico no lo hace un 5, pero tampoco lo hace irrelevante. La subida de
  75 pb de junio de 2022, la mayor desde 1994, dejó el S&P en +0,7% a cinco sesiones: estaba
  descontada desde el IPC de dos días antes. Eso la baja de peldaño; sigue siendo
  "relevante": true, porque es una decisión del FOMC.
- Una reforma institucional o un cambio de personal en la Fed no pasa de 3 salvo que altere
  la votación de la próxima reunión.
- Un análisis o una opinión sobre lo que la Fed "podría" hacer nunca pasa de 2.

"evento_key": identificador del HECHO, no del titular, con la forma
  <tipo-de-hecho>-<AAAA-MM-DD>
con el vocabulario cerrado: fomc-decision, fomc-actas, dato-ipc, dato-empleo, dato-pce,
declaracion-warsh, declaracion-bessent, declaracion-gobernador, nombramiento-fed,
presion-politica-fed. Ejemplo: "dato-ipc-2026-09-11".

"resumen": una frase en español neutro.
"motivo": media frase con el efecto esperado en el Nasdaq y el S&P 500, nombrando magnitud.`

interface RespuestaLlm {
  relevante?: unknown
  severidad?: unknown
  evento_key?: unknown
  resumen?: unknown
  motivo?: unknown
}

/** Extracción defensiva: el modelo a veces envuelve el JSON en un bloque de código. */
export function extraerJson(raw: string): RespuestaLlm | null {
  const intentos = [raw]
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) intentos.push(fence[1])
  const llaves = raw.match(/\{[\s\S]*\}/)
  if (llaves) intentos.push(llaves[0])

  for (const intento of intentos) {
    try {
      const parsed = JSON.parse(intento.trim())
      if (parsed && typeof parsed === 'object') return parsed as RespuestaLlm
    } catch { /* siguiente estrategia */ }
  }
  return null
}

/**
 * Normaliza la respuesta del modelo.
 *
 * Todo lo que venga mal formado degrada a "no relevante": una alerta de más por
 * un JSON roto cuesta credibilidad, y la credibilidad es lo único que hace que
 * el mensaje se lea a las tres de la mañana.
 */
export function normalizar(bruto: RespuestaLlm | null, tipo: TipoAlerta): Clasificacion {
  const noRelevante: Clasificacion = {
    relevante: false, tipo, severidad: 1, eventoKey: '', resumen: '', motivo: 'respuesta ilegible',
  }
  if (!bruto) return noRelevante

  const severidadNum = Math.round(Number(bruto.severidad))
  const eventoKey = String(bruto.evento_key ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)

  const relevante = bruto.relevante === true && eventoKey.length > 0 && Number.isFinite(severidadNum)
  if (!relevante) return { ...noRelevante, motivo: String(bruto.motivo ?? 'descartado') }

  return {
    relevante: true,
    tipo,
    severidad: Math.min(5, Math.max(1, severidadNum)),
    eventoKey,
    resumen: String(bruto.resumen ?? '').slice(0, 400),
    motivo: String(bruto.motivo ?? '').slice(0, 400),
  }
}

/**
 * @param ahora Momento que se le presenta al modelo como «ahora». En producción
 *   es la hora real y no hay que pasarlo. Existe para la recalibración: el
 *   prompt descarta por diseño todo lo anterior a 48 horas, así que reejecutarlo
 *   sobre el corpus histórico con la hora de hoy daría `relevante: false` en los
 *   el corpus entero y no mediría nada. Pasando la fecha del suceso, el modelo juzga
 *   el titular como lo habría juzgado el día que ocurrió.
 */
export async function clasificarTitular(
  titular: Titular,
  tipo: 'guerra' | 'fed_tesoro',
  ahora: Date = new Date(),
): Promise<Clasificacion> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY no configurada')

  const model = process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-chat-v3-0324'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const mensaje = `TITULAR: ${titular.titulo}
FUENTE: ${titular.fuente}
PUBLICADO: ${titular.publicadoAt ?? 'desconocido'}
URL: ${titular.url}
AHORA: ${ahora.toISOString()}

Responde SOLO con el JSON.`

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(30_000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': siteUrl,
      'X-Title': 'Alertas tempranas Departamento de Riesgos',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: tipo === 'guerra' ? SISTEMA_GUERRA : SISTEMA_MACRO },
        { role: 'user', content: mensaje },
      ],
      temperature: 0.1,
      max_tokens: 400,
    }),
  })

  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
  return normalizar(extraerJson(data.choices?.[0]?.message?.content ?? ''), tipo)
}

/**
 * Clasifica una tanda de titulares en serie.
 *
 * En serie a propósito: son pocas llamadas por ciclo y OpenRouter limita por
 * ráfaga. Un fallo aislado no interrumpe la tanda.
 */
export async function clasificarTitulares(
  titulares: Titular[],
  tipo: 'guerra' | 'fed_tesoro',
  maximo = 12,
): Promise<{ clasificados: TitularClasificado[]; errores: string[] }> {
  const clasificados: TitularClasificado[] = []
  const errores: string[] = []

  for (const titular of titulares.slice(0, maximo)) {
    try {
      clasificados.push({ ...titular, clasificacion: await clasificarTitular(titular, tipo) })
    } catch (e) {
      errores.push(`${titular.titulo.slice(0, 60)}: ${(e as Error).message}`)
    }
  }

  return { clasificados, errores }
}
