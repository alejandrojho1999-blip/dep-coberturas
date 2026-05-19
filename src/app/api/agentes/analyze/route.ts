import { createClient } from '@/lib/supabase/server'
import YahooFinance from 'yahoo-finance2'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

interface AnalyzeBody {
  ticker: string
  lastPrice: number
  category: string
  score: number
  marketCapM?: number
  forecastReturn?: number
  momentumScore?: number
  rsi?: number
  macd?: number
  macdSignal?: number
}

interface AnalysisResult {
  empresa: string
  direction: string
  riesgo: string
  timeframe: string
  precio_objetivo: number
  stop_loss: number
  resumen: string
  conviction?: number
  consensus?: string
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return Response.json({ error: 'OPENROUTER_API_KEY no configurada' }, { status: 500 })

  const body = await request.json() as AnalyzeBody
  const { ticker, lastPrice, category, score, marketCapM, forecastReturn, momentumScore, rsi, macd, macdSignal } = body

  let empresa = ticker
  let fundamentals = `Ticker: ${ticker}\nPrecio: $${lastPrice.toFixed(2)}\nScore Lynch: ${score}/6`
  try {
    const yf = new YahooFinance()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summary = await yf.quoteSummary(ticker, { modules: ['summaryProfile', 'financialData', 'defaultKeyStatistics'] }) as any
    const p = summary?.summaryProfile ?? {}
    const f = summary?.financialData ?? {}
    const s = summary?.defaultKeyStatistics ?? {}
    empresa = (p.longName ?? p.shortName ?? ticker) as string
    fundamentals = [
      `Empresa: ${empresa}`,
      `Sector: ${(p.sector ?? 'N/D') as string} | Industria: ${(p.industry ?? 'N/D') as string}`,
      `Precio actual: $${lastPrice.toFixed(2)}`,
      `Score Lynch: ${score}/6`,
      `Market Cap: ${marketCapM != null ? `$${(marketCapM / 1000).toFixed(1)}B` : 'N/D'}`,
      `P/E Forward: ${s.forwardPE ?? 'N/D'} | PEG: ${s.pegRatio ?? 'N/D'}`,
      `Margen bruto: ${f.grossMargins != null ? `${(f.grossMargins * 100).toFixed(1)}%` : 'N/D'}`,
      `ROE: ${f.returnOnEquity != null ? `${(f.returnOnEquity * 100).toFixed(1)}%` : 'N/D'}`,
    ].join('\n')
  } catch { /* use minimal data */ }

  const agentName = category === 'PETER_LYNCH' ? 'AGENTE PETER' : 'AGENTE SMALL CAP'
  const model = process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-chat-v3-0324'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const forecastLine = forecastReturn != null
    ? `TimesFM Forecast 30d: ${forecastReturn >= 0 ? '+' : ''}${forecastReturn.toFixed(1)}%`
    : ''
  const momentumLine = momentumScore != null
    ? `Momentum Score: ${momentumScore}/3 | RSI-14: ${rsi?.toFixed(0) ?? 'N/D'} | MACD: ${(macd ?? 0) > (macdSignal ?? 0) ? 'ALCISTA' : 'BAJISTA'}`
    : ''

  const prompt = `Eres el Chief Investment Officer de Emporium Quality Funds coordinando 3 agentes especializados para analizar ${ticker}.

DATOS CUANTITATIVOS:
${fundamentals}
${forecastLine}
${momentumLine}

=== AGENTE 1 — ANALISTA TÉCNICO ===
Evalúa el forecast de precio a 30 días y los indicadores de momentum (RSI, MACD).
Determina si los indicadores técnicos apoyan una posición larga. Sé conciso (1 oración).
Recomendación técnica: COMPRA / NEUTRO / VENTA con confianza 1-10.

=== AGENTE 2 — ANALISTA FUNDAMENTAL ===
Evalúa el score Lynch ${score}/6, P/E, PEG, márgenes y ROE.
Determina si los fundamentales justifican una valoración premium. Sé conciso (1 oración).
Recomendación fundamental: COMPRA / NEUTRO / VENTA con confianza 1-10.

=== AGENTE 3 — PORTFOLIO MANAGER (SÍNTESIS) ===
Considera ambos agentes y genera la recomendación final. Solo aprueba si hay consenso alcista.
conviction = promedio ponderado de ambas confianzas (técnica 40% + fundamental 60%), redondeado a entero.

Responde SOLO con JSON válido (sin markdown, sin explicación):
{
  "empresa": "${empresa}",
  "direction": "COMPRA",
  "riesgo": "BAJO|MEDIO|ALTO",
  "timeframe": "CORTO|MEDIANO|LARGO",
  "precio_objetivo": <número, objetivo 12 meses>,
  "stop_loss": <número, 8-12% debajo del precio actual>,
  "conviction": <entero 1-10, donde 10 = máxima convicción alcista>,
  "consensus": "ALCISTA|NEUTRAL|BAJISTA",
  "resumen": "2-3 oraciones: tesis de inversión integrando Lynch, forecast y momentum"
}`

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(60_000),
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': siteUrl,
      'X-Title': `EQF ${agentName}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.15,
      max_tokens: 600,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return Response.json({ error: `OpenRouter ${res.status}: ${err}` }, { status: 500 })
  }

  const aiData = await res.json() as { choices: Array<{ message: { content: string } }> }
  const raw = (aiData.choices?.[0]?.message?.content ?? '').trim()

  let parsed: AnalysisResult
  try {
    const m = raw.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(m?.[0] ?? raw) as AnalysisResult
  } catch {
    return Response.json({ error: 'AI JSON inválido', raw }, { status: 500 })
  }

  if (!parsed.stop_loss || parsed.stop_loss >= lastPrice)
    parsed.stop_loss = parseFloat((lastPrice * 0.92).toFixed(2))
  if (!parsed.precio_objetivo || parsed.precio_objetivo <= lastPrice)
    parsed.precio_objetivo = parseFloat((lastPrice * 1.15).toFixed(2))

  return Response.json(parsed)
}
