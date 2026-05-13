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
  sma20?: number
}

interface AnalysisResult {
  empresa: string
  direction: string
  riesgo: string
  timeframe: string
  precio_objetivo: number
  stop_loss: number
  resumen: string
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return Response.json({ error: 'OPENROUTER_API_KEY no configurada' }, { status: 500 })

  const body = await request.json() as AnalyzeBody
  const { ticker, lastPrice, category, score, marketCapM, sma20 } = body

  let fundamentals = `Ticker: ${ticker}\nPrecio: $${lastPrice.toFixed(2)}\nScore Lynch: ${score}/6`
  try {
    const yf = new YahooFinance()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summary = await yf.quoteSummary(ticker, { modules: ['summaryProfile', 'financialData', 'defaultKeyStatistics'] }) as any
    const p = summary?.summaryProfile ?? {}
    const f = summary?.financialData ?? {}
    const s = summary?.defaultKeyStatistics ?? {}
    fundamentals = [
      `Empresa: ${(p.longName ?? p.shortName ?? ticker) as string}`,
      `Sector: ${(p.sector ?? 'N/D') as string} | Industria: ${(p.industry ?? 'N/D') as string}`,
      `Precio actual: $${lastPrice.toFixed(2)} | SMA-20: $${sma20?.toFixed(2) ?? 'N/D'}`,
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

  const prompt = `Eres analista cuantitativo de Emporium Quality Funds. El ${agentName} ha preseleccionado ${ticker} con score Lynch ${score}/6 y tendencia alcista confirmada.

DATOS:
${fundamentals}

Responde SOLO con JSON válido (sin markdown, sin explicación):
{
  "empresa": "nombre completo",
  "direction": "COMPRA",
  "riesgo": "BAJO|MEDIO|ALTO",
  "timeframe": "CORTO|MEDIANO|LARGO",
  "precio_objetivo": <número, precio objetivo 12 meses basado en fundamentales>,
  "stop_loss": <número, típicamente 8-12% debajo del precio actual>,
  "resumen": "2-3 oraciones: tesis de inversión basada en score Lynch y fundamentales"
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
      temperature: 0.1,
      max_tokens: 400,
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
