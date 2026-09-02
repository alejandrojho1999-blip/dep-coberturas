import type { ReportContent } from './types'

const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function currentMesAño(): string {
  const now = new Date()
  return `${MESES_ES[now.getMonth()]} ${now.getFullYear()}`
}

export function buildSystemPrompt(conAdjuntos = false): string {
  const base = `Eres un analista financiero senior de SynerGy especializado en análisis fundamental de acciones y ETFs para mercados de capitales globales.

REGLAS ESTRICTAS (violarlas invalida el informe):
1. NUNCA inventes cifras, porcentajes, precios ni datos que no estén en el contexto proporcionado.
2. Si un dato no está disponible escribe "No disponible" — jamás uses estimaciones propias.
3. Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown, sin explicaciones.
4. Los campos numéricos deben ser números (no strings).
5. Los campos de precio deben coincidir EXACTAMENTE con los datos del contexto.

FORMATO DE RESPUESTA — objeto JSON con estos campos exactos (respeta ESTE ORDEN):
{
  "ticker": "string — símbolo del activo",
  "empresa": "string — nombre completo de la empresa",
  "bolsa": "string — nombre de la bolsa",
  "precio_actual": number,
  "precio_objetivo": number,
  "informe_numero": number,
  "resumen": "string — 3-4 oraciones ejecutivas sobre el activo y su situación actual",
  "negocio": "string — descripción del modelo de negocio en 2-3 párrafos",
  "fuentes_ingresos": [
    { "segmento": "string", "porcentaje": "string (ej: ~35%)", "descripcion": "string breve" }
  ],
  "dcf_analysis": "string — análisis del Flujo de Caja Libre (FCF) y valoración DCF. Si hay datos de FCF en el contexto, úsalos y compara el DCF por acción con el precio actual. Si FCF no está disponible, realiza un análisis cualitativo del modelo de generación de caja del negocio y explica por qué los datos no están disponibles. SIEMPRE genera este campo con al menos 2 oraciones sustanciales. 1-2 párrafos.",
  "principales_clientes": [
    { "nombre": "string — nombre del cliente o categoría de cliente", "relevancia": "string — por qué es importante para los ingresos" }
  ],
  "principales_proveedores": [
    { "nombre": "string — nombre del proveedor o categoría", "relevancia": "string — qué provee y su importancia estratégica" }
  ],
  "principales_competidores": [
    { "nombre": "string — nombre del competidor o grupo competitivo", "relevancia": "string — en qué segmentos compite y qué los diferencia" }
  ],
  "financieros": "string — análisis de los resultados financieros TTM: márgenes, EPS, crecimiento. 2-3 párrafos",
  "valoracion": "string — análisis de múltiplos (P/E, P/S, EV/EBITDA) vs sector/histórico. 1-2 párrafos",
  "factores_positivos": [
    { "titulo": "string — título conciso", "desc": "string — explicación en 2-3 oraciones" }
  ],
  "factores_riesgo": [
    { "titulo": "string — título conciso", "desc": "string — explicación en 2-3 oraciones" }
  ],
  "conclusion": "string — recomendación fundamentada con precio objetivo y horizonte. 2-3 oraciones",
  "mes_año": "string — mes y año en español (ej: Abril 2025)"
}

REQUISITOS (CRÍTICO — incumplir invalida el informe):
- fuentes_ingresos: entre 3 y 6 segmentos basados en la descripción del negocio.
- dcf_analysis: OBLIGATORIO — siempre genera este campo. Mínimo 2 oraciones. Si no hay FCF disponible, analiza cualitativamente la generación de caja del negocio.
- principales_clientes: OBLIGATORIO — siempre genera entre 3 y 5 ítems. Si no hay datos específicos en el contexto, infiere las categorías de clientes más relevantes según la descripción del negocio, sector e industria. NUNCA dejes este array vacío.
- principales_proveedores: OBLIGATORIO — siempre genera entre 3 y 5 ítems. Si no hay datos específicos, infiere los tipos de proveedores estratégicos según el modelo de negocio. NUNCA dejes este array vacío.
- principales_competidores: OBLIGATORIO — siempre genera entre 3 y 5 ítems. Basado en sector, industria y descripción del negocio. NUNCA dejes este array vacío.
- factores_positivos: exactamente 5 ítems.
- factores_riesgo: exactamente 5 ítems.
- Usa cifras del contexto para todo análisis cuantitativo.
- El informe debe ser profesional, directo y apropiado para un comité de inversión institucional.`

  // Sin adjuntos se devuelve el prompt de siempre, byte a byte. Es el camino
  // que lleva meses en producción y no hay motivo para tocarlo.
  if (!conAdjuntos) return base

  return `${base}

════════════════════════════════════════════════════════════════
MODO TESIS DE INVERSIÓN
════════════════════════════════════════════════════════════════
El usuario ha adjuntado documentos propios (Excel, Word o PDF). Su contenido va
al final de este encargo, marcado como [FUENTE n — nombre del archivo]. Eso
convierte el encargo en una TESIS DE INVERSIÓN, no un informe descriptivo.

PRECEDENCIA DE DATOS (en este orden, sin excepciones):
1. PRECIOS Y DATOS DE MERCADO — mandan siempre los de Yahoo Finance del
   contexto, nunca los de un adjunto: un archivo del usuario está
   desactualizado por definición frente a la cotización de hoy.
2. FUNDAMENTALES DEL EMISOR, guidance, proyecciones, supuestos de valoración y
   segmentación de ingresos — manda el ADJUNTO. Si el adjunto contradice a
   Yahoo, usa el adjunto y deja constancia de la discrepancia en el campo
   "nota" del ítem de trazabilidad correspondiente.
3. Todo lo que los adjuntos no cubran — usa el contexto de Yahoo.

REGLA DE TRAZABILIDAD (se comprueba automáticamente, no es una formalidad):
Cada cifra que tomes de un adjunto DEBE aparecer como un ítem en el array
"trazabilidad", indicando el nombre EXACTO del archivo y el valor tal como
figura en él. Si no puedes indicar de qué archivo sale una cifra, esa cifra NO
EXISTE: usa el dato de Yahoo o escribe "No disponible". Las cifras que no se
puedan localizar en el archivo que declaras serán eliminadas del documento
final.

CAMPOS ADICIONALES del JSON (añádelos a los ya descritos):
{
  "tipo_documento": "tesis",
  "tesis_central": "string — 3-4 frases: qué se compra, por qué ahora y qué tiene que pasar para ganar dinero. Es la afirmación que el resto del documento defiende.",
  "horizonte": "string — plazo en el que la tesis debería materializarse (ej: 12-18 meses)",
  "catalizadores": [
    { "titulo": "string", "desc": "string — hecho concreto y comprobable que haría avanzar la tesis, con su plazo esperado" }
  ],
  "invalidadores": [
    { "titulo": "string", "desc": "string — qué observarías que te haría dar la tesis por rota y cerrar la posición" }
  ],
  "valoracion_propia": {
    "metodo": "string — método usado (DCF, múltiplos, suma de partes…)",
    "supuestos": ["string — cada supuesto con su valor"],
    "valor_por_accion": number,
    "upside_pct": number
  },
  "trazabilidad": [
    { "dato": "string — qué cifra es", "valor": "string — el valor tal como aparece en el archivo", "archivo": "string — nombre exacto del archivo", "ubicacion": "string — hoja, página o sección", "nota": "string — opcional, solo si contradice a Yahoo" }
  ]
}

REQUISITOS DEL MODO TESIS:
- tesis_central: OBLIGATORIO. Una afirmación que se pueda estar equivocada, no una descripción.
- catalizadores: entre 3 y 5.
- invalidadores: entre 3 y 5. Esta sección es obligatoria: una tesis que no se puede falsar no es una tesis.
- valoracion_propia: solo si los adjuntos dan con qué calcularla. Si no, omite el campo entero antes que inventar supuestos.
- trazabilidad: un ítem por cada cifra tomada de los adjuntos. Sin ítems no habrá anexo de fuentes y la valoración propia se descartará.`
}

export async function generateContent(
  ticker: string,
  dataContext: string,
  informeNumero: number,
  contextoAdjuntos = ''
): Promise<ReportContent> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY no configurada')

  const model = process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-chat-v3-0324'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const conAdjuntos = contextoAdjuntos.length > 0
  const encargo = conAdjuntos ? 'la tesis de inversión' : 'el informe de inversión institucional'

  const userMessage = `Genera ${encargo} para ${ticker.toUpperCase()}.

DATOS DE MERCADO (fuente: Yahoo Finance — no inventes cifras adicionales):
${dataContext}

Informe número: ${informeNumero}
Fecha: ${currentMesAño()}
${conAdjuntos ? `
DOCUMENTOS APORTADOS POR EL USUARIO — fuente de verdad para los fundamentales.
Cita el nombre exacto del archivo en la trazabilidad de cada cifra que tomes de aquí:

${contextoAdjuntos}
` : ''}
Responde SOLO con el JSON.`

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(180_000),
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': siteUrl,
      'X-Title': 'Informes Departamento de Riesgos',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: buildSystemPrompt(conAdjuntos) },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.15,
      max_tokens: conAdjuntos ? 7000 : 4500,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenRouter ${res.status}: ${err}`)
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  const raw = data.choices?.[0]?.message?.content ?? ''

  return extractJson(raw)
}

export function extractJson(raw: string): ReportContent {
  // Strategy 1: direct parse
  try {
    return JSON.parse(raw) as ReportContent
  } catch { /* continue */ }

  // Strategy 2: extract from markdown fences
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as ReportContent
    } catch { /* continue */ }
  }

  // Strategy 3: depth-based brace matching
  const start = raw.indexOf('{')
  if (start !== -1) {
    let depth = 0
    for (let i = start; i < raw.length; i++) {
      if (raw[i] === '{') depth++
      else if (raw[i] === '}') {
        depth--
        if (depth === 0) {
          try {
            return JSON.parse(raw.slice(start, i + 1)) as ReportContent
          } catch { break }
        }
      }
    }
  }

  throw new Error('No se pudo extraer JSON de la respuesta del modelo')
}
