import { createClient } from '@/lib/supabase/server'
import { isIP } from 'node:net'

const SECTOR_TREATMENTS: Record<string, { treatment: string; label: string }> = {
  Technology:           { treatment: 'RND_Growth',   label: 'Crecimiento en I+D (YoY)' },
  'Basic Materials':    { treatment: 'AISC_Change',  label: 'Cambio en AISC ($/oz)' },
  Energy:               { treatment: 'CAPEX_Growth', label: 'Crecimiento en CAPEX (YoY)' },
  'Financial Services': { treatment: 'NIM_Change',   label: 'Cambio en Margen Neto de Interés' },
  Financials:           { treatment: 'NIM_Change',   label: 'Cambio en Margen Neto de Interés' },
  Healthcare:           { treatment: 'RND_Growth',   label: 'Crecimiento en I+D (YoY)' },
  Mining:               { treatment: 'AISC_Change',  label: 'Cambio en AISC ($/oz)' },
}

interface ExtractedVariable {
  variable: string
  label: string
  rationale: string
}

const DEFAULT_CONFOUNDERS: ExtractedVariable[] = [
  { variable: 'YIELD_10Y', label: 'Tasa bono 10Y EEUU', rationale: 'Tasa libre de riesgo que afecta valuación DCF' },
  { variable: 'FED_RATE',  label: 'Tasa de política Fed', rationale: 'Costo del capital afecta múltiplos y decisiones de inversión' },
  { variable: 'VIX',       label: 'Índice de volatilidad VIX', rationale: 'Sentimiento de mercado y aversión al riesgo' },
]

const DEFAULT_COLLIDERS: ExtractedVariable[] = [
  { variable: 'PE_RATIO',      label: 'Price/Earnings ratio', rationale: 'Endógeno al precio — colisionador clásico' },
  { variable: 'PX_TO_BOOK',   label: 'Price/Book ratio',      rationale: 'Precio de mercado causa tanto P/B como retorno futuro' },
]

function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  if (normalized === 'localhost' || normalized.endsWith('.localhost')) return true

  const ipVersion = isIP(normalized)
  if (ipVersion === 4) {
    const [a, b] = normalized.split('.').map(Number)
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      normalized === '0.0.0.0'
    )
  }
  if (ipVersion === 6) {
    return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80')
  }

  return false
}

function safeExternalHttpsUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== 'https:') return null
    if (parsed.username || parsed.password) return null
    if (isPrivateHostname(parsed.hostname)) return null
    return parsed
  } catch {
    return null
  }
}

const DEEPSEEK_SYSTEM = (ticker: string, sector: string) => `
Eres un analista financiero causal experto en el framework de López de Prado (2025).
Analiza la página de Investor Relations de ${ticker} (sector: ${sector}) e identifica:

1. TRATAMIENTO: la variable de negocio más relevante que CAUSA causalmente el retorno futuro.
   Candidatos por sector: Technology/Healthcare→RND_Growth, Mining/Materials→AISC_Change,
   Energy→CAPEX_Growth, Financial→NIM_Change, Default→Revenue_Growth.

2. CONFUSORES: variables que afectan TANTO al tratamiento COMO al retorno futuro (deben controlarse).
   Siempre incluir: YIELD_10Y, FED_RATE, VIX. Añadir 1-2 específicas del sector si aplica.

3. COLISIONADORES: variables afectadas por el tratamiento O por el retorno futuro (NO controlar, excluir).
   Ejemplos típicos: PE_RATIO, PX_TO_BOOK, EV_EBITDA, Net_Income (si es descendiente de la inversión).

Responde EXCLUSIVAMENTE en JSON válido sin markdown:
{
  "treatment": "VARIABLE_NAME",
  "label": "Descripción legible",
  "rationale": "Una oración",
  "confounders": [
    {"variable": "NOMBRE_VARIABLE", "label": "Descripción", "rationale": "Por qué es confusor"}
  ],
  "colliders": [
    {"variable": "NOMBRE_VARIABLE", "label": "Descripción", "rationale": "Por qué es colisionador"}
  ]
}
`.trim()

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    irUrl?: string
    ticker?: string
    sector?: string
  }
  const { irUrl, ticker, sector } = body

  if (!ticker || !sector) {
    return Response.json({ error: 'Missing ticker or sector' }, { status: 400 })
  }

  // Fetch IR page content
  let irContent = ''
  if (irUrl && !irUrl.includes('google.com/search')) {
    const safeUrl = safeExternalHttpsUrl(irUrl)
    if (!safeUrl) return Response.json({ error: 'Invalid IR URL' }, { status: 400 })

    try {
      const res = await fetch(safeUrl, { signal: AbortSignal.timeout(8000) })
      if (res.ok) {
        const html = await res.text()
        irContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 8000)
      }
    } catch {
      // ignore — fallback to sector defaults
    }
  }

  // Defaults
  const sectorDefault = SECTOR_TREATMENTS[sector]
  let treatment = sectorDefault?.treatment ?? 'Revenue_Growth'
  let label = sectorDefault?.label ?? 'Crecimiento en Ingresos (YoY)'
  let rationale = `Seleccionado por sector: ${sector}`
  let confounders: ExtractedVariable[] = DEFAULT_CONFOUNDERS
  let colliders: ExtractedVariable[] = DEFAULT_COLLIDERS

  // Try AI extraction
  const apiKey = process.env.OPENROUTER_API_KEY
  if (apiKey && irContent) {
    try {
      const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://dep-coberturas.vercel.app',
          'X-Title': 'Dep Coberturas — Causal IR Extract',
        },
        body: JSON.stringify({
          model: 'deepseek/deepseek-chat',
          messages: [
            { role: 'system', content: DEEPSEEK_SYSTEM(ticker, sector) },
            { role: 'user', content: `Contenido de la página IR:\n${irContent}` },
          ],
          max_tokens: 600,
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(12000),
      })

      if (aiRes.ok) {
        const aiData = await aiRes.json() as {
          choices?: Array<{ message?: { content?: string } }>
        }
        const raw = aiData.choices?.[0]?.message?.content ?? ''
        const parsed = JSON.parse(raw.trim()) as {
          treatment?: string
          label?: string
          rationale?: string
          confounders?: ExtractedVariable[]
          colliders?: ExtractedVariable[]
        }
        if (parsed.treatment) treatment = parsed.treatment
        if (parsed.label) label = parsed.label
        if (parsed.rationale) rationale = parsed.rationale
        if (Array.isArray(parsed.confounders) && parsed.confounders.length > 0) {
          confounders = parsed.confounders
        }
        if (Array.isArray(parsed.colliders) && parsed.colliders.length > 0) {
          colliders = parsed.colliders
        }
      }
    } catch {
      // keep defaults
    }
  }

  // Save extracted variables to causal_variables if user is authenticated
  if (user) {
    const tickerUpper = ticker.toUpperCase()
    const rows = [
      ...confounders.map((c) => ({
        user_id: user.id,
        ticker: tickerUpper,
        variable: c.variable,
        type: 'confounder' as const,
        source: 'auto' as const,
        label: c.label,
        rationale: c.rationale,
      })),
      ...colliders.map((c) => ({
        user_id: user.id,
        ticker: tickerUpper,
        variable: c.variable,
        type: 'collider' as const,
        source: 'auto' as const,
        label: c.label,
        rationale: c.rationale,
      })),
    ]
    // upsert — silently ignore duplicates
    await supabase
      .from('causal_variables')
      .upsert(rows, { onConflict: 'user_id,ticker,variable,type' })
  }

  return Response.json({ treatment, label, rationale, confounders, colliders })
}
