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
- Invocación del artículo 4 o del artículo 5, o movilización/despliegue militar de la Alianza.
- Amenaza o ejercicio nuclear ruso, o cambio de nivel de alerta.
- Sabotaje de infraestructura crítica atribuido a un Estado (cables, gasoductos, red eléctrica).
- Ruptura o firma de un alto el fuego, o ultimátum formal entre las partes.

Es FALSE: análisis, opinión, encuestas, declaraciones rutinarias, recapitulaciones,
aniversarios, deportes, cultura, y cualquier suceso anterior a las últimas 48 horas.

Severidad: 1 declaración tensa · 2 incidente menor · 3 incidente militar directo
· 4 víctimas o daño en territorio OTAN, artículo 4 · 5 artículo 5, ataque abierto o nuclear.

"evento_key": identificador corto en minúsculas y con guiones que describa EL HECHO,
no el titular, para que dos medios distintos generen la misma clave.
Ejemplo: "dron-ruso-derribado-polonia-2026-08-31".

"resumen": una sola frase en español neutro, sin adjetivos, con el hecho y el lugar.
"motivo": media frase explicando por qué mueve (o no) el precio del oro y bitcoin.`

const SISTEMA_MACRO = `Eres el analista macro de una mesa de trading.
Clasificas titulares sobre el pulso entre la Reserva Federal (presidida por Warsh, partidario de
subir tasas para llevar la inflación al objetivo del 2% manteniendo el pleno empleo) y el Tesoro
(Bessent, partidario de que las tasas se mantengan).

Devuelves SOLO un JSON con esta forma exacta:
{"relevante": boolean, "severidad": 1-5, "evento_key": "string", "resumen": "string", "motivo": "string"}

Es "relevante" solo si el titular aporta información NUEVA sobre la trayectoria de las tasas:
declaración de Warsh, Bessent, un gobernador de la Fed o del Tesoro; comunicado del FOMC;
dato de inflación o empleo; presión política sobre la independencia del banco central;
cambio en la composición del comité.

Es FALSE: análisis de terceros, opinión de bancos privados, resúmenes de mercado,
repeticiones de declaraciones ya conocidas.

Severidad: 1 comentario menor · 2 declaración con matiz nuevo · 3 declaración que cambia el
sesgo esperado · 4 dato macro o decisión que altera la probabilidad de la próxima reunión
· 5 decisión de tasas fuera de lo esperado o crisis institucional en la Fed.

"evento_key": identificador corto en minúsculas y con guiones del HECHO, no del titular.
"resumen": una frase en español neutro.
"motivo": media frase sobre el efecto esperado en Nasdaq y S&P 500.`

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

export async function clasificarTitular(
  titular: Titular,
  tipo: 'guerra' | 'fed_tesoro',
): Promise<Clasificacion> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY no configurada')

  const model = process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-chat-v3-0324'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const mensaje = `TITULAR: ${titular.titulo}
FUENTE: ${titular.fuente}
PUBLICADO: ${titular.publicadoAt ?? 'desconocido'}
URL: ${titular.url}
AHORA: ${new Date().toISOString()}

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
