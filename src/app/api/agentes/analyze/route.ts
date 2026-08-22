import { createClient } from '@/lib/supabase/server'
import YahooFinance from 'yahoo-finance2'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

interface AnalyzeBody {
  ticker: string
  /** Precio del SUBYACENTE, no la prima del contrato. */
  lastPrice: number
  category: string
  score?: number
  marketCapM?: number
  forecastReturn?: number
  momentumScore?: number
  rsi?: number
  macd?: number
  macdSignal?: number
  // Campos de opción (Gamma y Theta). Sin ellos el análisis es el de acciones.
  optionType?: 'CALL' | 'PUT'
  strategy?: 'SELL_PUT' | 'COVERED_CALL'
  strike?: number
  expiration?: string
  premium?: number
  delta?: number
  impliedVolatility?: number
  dte?: number
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
  /** Cifra propuesta por la IA, conservada para poder contrastar el objetivo. */
  precio_objetivo_ia?: number | null
  /** De dónde salió `precio_objetivo`. */
  objetivo_fuente?: 'consenso' | 'ia' | 'fallback'
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return Response.json({ error: 'OPENROUTER_API_KEY no configurada' }, { status: 500 })

  const body = await request.json() as AnalyzeBody
  const {
    ticker, lastPrice, category, score, marketCapM, forecastReturn, momentumScore, rsi, macd, macdSignal,
    optionType, strategy, strike, expiration, premium, delta, impliedVolatility, dte,
  } = body

  // Todo el análisis parte del precio del subyacente. Sin él no hay nada que
  // valorar, y dejarlo caer a 0 produciría un dictamen construido sobre una
  // cifra inventada, que es justo lo que este endpoint no debe hacer.
  if (!Number.isFinite(lastPrice) || lastPrice <= 0)
    return Response.json({ error: 'lastPrice (precio del subyacente) ausente o no válido' }, { status: 400 })

  // Gamma y Theta operan contratos, no acciones. El análisis es otro: importa el
  // contrato (strike, plazo, prima, delta) tanto como el subyacente, y pedirles
  // el cuestionario de Lynch no tenía sentido.
  const esOpcion = category === 'OPTIONS_GAMMA' || category === 'OPTIONS_THETA'
  const scoreLine = score != null ? `Score Lynch: ${score}/6` : ''

  let empresa = ticker
  let fundamentals = [`Ticker: ${ticker}`, `Precio: $${lastPrice.toFixed(2)}`, scoreLine]
    .filter(Boolean).join('\n')
  // Objetivo del consenso de analistas de Yahoo. Es un dato verificable, a
  // diferencia de la cifra que propone la IA, así que tiene prioridad.
  let targetMeanPrice: number | null = null
  try {
    const yf = new YahooFinance()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summary = await yf.quoteSummary(ticker, { modules: ['summaryProfile', 'financialData', 'defaultKeyStatistics'] }) as any
    const p = summary?.summaryProfile ?? {}
    const f = summary?.financialData ?? {}
    const s = summary?.defaultKeyStatistics ?? {}
    empresa = (p.longName ?? p.shortName ?? ticker) as string
    const rawTarget = Number(f.targetMeanPrice)
    if (Number.isFinite(rawTarget) && rawTarget > 0) targetMeanPrice = rawTarget
    fundamentals = [
      `Empresa: ${empresa}`,
      `Sector: ${(p.sector ?? 'N/D') as string} | Industria: ${(p.industry ?? 'N/D') as string}`,
      `Precio actual del subyacente: $${lastPrice.toFixed(2)}`,
      scoreLine,
      `Market Cap: ${marketCapM != null ? `$${(marketCapM / 1000).toFixed(1)}B` : 'N/D'}`,
      `P/E Forward: ${s.forwardPE ?? 'N/D'} | PEG: ${s.pegRatio ?? 'N/D'}`,
      `Margen bruto: ${f.grossMargins != null ? `${(f.grossMargins * 100).toFixed(1)}%` : 'N/D'}`,
      `ROE: ${f.returnOnEquity != null ? `${(f.returnOnEquity * 100).toFixed(1)}%` : 'N/D'}`,
    ].filter(Boolean).join('\n')
  } catch { /* use minimal data */ }

  const agentName = category === 'PETER_LYNCH' ? 'AGENTE PETER'
    : category === 'OPTIONS_GAMMA' ? 'AGENTE GAMMA'
    : category === 'OPTIONS_THETA' ? 'AGENTE THETA'
    : 'AGENTE SMALL'
  const model = process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-chat-v3-0324'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  // El nombre importa: la proyección es una regresión lineal sobre 60 cierres
  // mezclada 60/40 con una EWMA de 30 (ver `api/agentes/forecast`). Llamarla
  // "TimesFM" —un modelo de fundación que este código no usa— le atribuía al
  // dato una autoridad que no tiene, y el modelo lee esta línea literalmente.
  const forecastLine = forecastReturn != null
    ? `Proyección 30d (regresión lineal + EWMA): ${forecastReturn >= 0 ? '+' : ''}${forecastReturn.toFixed(1)}%`
    : ''
  const momentumLine = momentumScore != null
    ? `Momentum Score: ${momentumScore}/3 | RSI-14: ${rsi?.toFixed(0) ?? 'N/D'} | MACD: ${(macd ?? 0) > (macdSignal ?? 0) ? 'ALCISTA' : 'BAJISTA'}`
    : ''

  const contratoLine = esOpcion
    ? [
        strategy === 'SELL_PUT' ? 'Operación: VENTA de PUT (se cobra la prima; obliga a comprar 100 acciones al strike si acaba dentro de dinero)'
          : strategy === 'COVERED_CALL' ? 'Operación: VENTA de CALL CUBIERTA (se cobra la prima; obliga a entregar 100 acciones al strike si acaba dentro de dinero)'
          : optionType === 'CALL' ? 'Operación: COMPRA de CALL (se paga la prima; pérdida máxima = prima)'
          : 'Operación: COMPRA de PUT (se paga la prima; pérdida máxima = prima)',
        strike != null ? `Strike: $${strike}` : '',
        expiration ? `Vencimiento: ${expiration}${dte != null ? ` (${dte} días)` : ''}` : '',
        premium != null ? `Prima del contrato: $${premium.toFixed(2)} por acción ($${(premium * 100).toFixed(0)} por contrato)` : '',
        delta != null ? `Delta: ${delta.toFixed(2)}` : '',
        impliedVolatility != null ? `Volatilidad implícita: ${(impliedVolatility * 100).toFixed(1)}%` : '',
      ].filter(Boolean).join('\n')
    : ''

  const promptOpcion = `Eres el Chief Investment Officer de SynerGy evaluando un contrato de opciones sobre ${ticker}.

DATOS DEL SUBYACENTE:
${fundamentals}
${forecastLine}

DATOS DEL CONTRATO:
${contratoLine}

=== AGENTE 1 — ANALISTA DEL SUBYACENTE ===
Evalúa si el movimiento que necesita esta operación es plausible en el plazo del contrato,
usando la proyección a 30 días y la situación de la empresa. Sé conciso (1 oración).

=== AGENTE 2 — ANALISTA DEL CONTRATO ===
Evalúa el contrato en sí: si la prima compensa el riesgo asumido dada la volatilidad implícita,
si el plazo es suficiente y si la distancia del strike al precio actual es razonable. Sé conciso (1 oración).

=== AGENTE 3 — GESTOR DE RIESGO (SÍNTESIS) ===
Decide si la operación merece capital. ${strategy ? 'Al VENDER primas el beneficio está limitado a la prima y la pérdida puede ser mucho mayor: sé exigente.' : 'Al COMPRAR opciones la pérdida máxima es el 100% de la prima y el tiempo corre en contra: sé exigente.'}
conviction = 1-10, donde 10 = máxima convicción en que esta operación concreta merece el riesgo.
Si el subyacente o el contrato no convencen, conviction debe ser baja: no fuerces la aprobación.

Responde SOLO con JSON válido (sin markdown, sin explicación):
{
  "empresa": "${empresa}",
  "riesgo": "BAJO|MEDIO|ALTO",
  "conviction": <entero 1-10>,
  "consensus": "ALCISTA|NEUTRAL|BAJISTA",
  "resumen": "2-3 oraciones: tesis de la operación, integrando subyacente y contrato"
}`

  const promptAccion = `Eres el Chief Investment Officer de SynerGy coordinando 3 agentes especializados para analizar ${ticker}.

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
Si los dos agentes no coinciden en COMPRA, la dirección debe ser NEUTRO o VENTA: no fuerces una compra.
conviction = promedio ponderado de ambas confianzas (técnica 40% + fundamental 60%), redondeado a entero.

Responde SOLO con JSON válido (sin markdown, sin explicación):
{
  "empresa": "${empresa}",
  "direction": "COMPRA|NEUTRO|VENTA",
  "riesgo": "BAJO|MEDIO|ALTO",
  "timeframe": "CORTO|MEDIANO|LARGO",
  "precio_objetivo": <número, objetivo 12 meses>,
  "stop_loss": <número, 8-12% debajo del precio actual>,
  "conviction": <entero 1-10, donde 10 = máxima convicción alcista>,
  "consensus": "ALCISTA|NEUTRAL|BAJISTA",
  "resumen": "2-3 oraciones: tesis de inversión integrando Lynch, forecast y momentum"
}`

  const prompt = esOpcion ? promptOpcion : promptAccion

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(60_000),
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': siteUrl,
      'X-Title': `SynerGy ${agentName}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      // Cero, no 0,15: la salida decide si una recomendación se guarda o se
      // descarta (`conviction >= 7`), así que un ticker en el límite podía dar
      // 6 o 7 en dos corridas del mismo día. No garantiza reproducibilidad
      // total —el proveedor no la ofrece— pero elimina el muestreo deliberado.
      temperature: 0,
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

  // Gamma y Theta derivan su objetivo y su stop de la prima del contrato, no del
  // subyacente, así que calcularlos aquí sería una cifra que nadie lee.
  if (esOpcion) return Response.json(parsed)

  if (!parsed.stop_loss || parsed.stop_loss >= lastPrice)
    parsed.stop_loss = parseFloat((lastPrice * 0.92).toFixed(2))

  // Precedencia del precio objetivo: consenso de analistas > cifra de la IA >
  // fallback +15%. Se conserva la cifra de la IA aparte para poder contrastarla,
  // y se marca el origen para que la procedencia sea auditable desde la tabla.
  const precioObjetivoIa = Number.isFinite(Number(parsed.precio_objetivo))
    ? parseFloat(Number(parsed.precio_objetivo).toFixed(2))
    : null
  parsed.precio_objetivo_ia = precioObjetivoIa

  if (targetMeanPrice != null && targetMeanPrice > lastPrice) {
    parsed.precio_objetivo = parseFloat(targetMeanPrice.toFixed(2))
    parsed.objetivo_fuente = 'consenso'
  } else if (precioObjetivoIa != null && precioObjetivoIa > lastPrice) {
    parsed.precio_objetivo = precioObjetivoIa
    parsed.objetivo_fuente = 'ia'
  } else {
    parsed.precio_objetivo = parseFloat((lastPrice * 1.15).toFixed(2))
    parsed.objetivo_fuente = 'fallback'
  }

  return Response.json(parsed)
}
