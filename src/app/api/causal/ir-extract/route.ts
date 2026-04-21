const SECTOR_TREATMENTS: Record<string, { treatment: string; label: string }> = {
  Technology:          { treatment: 'RND_Growth',     label: 'Crecimiento en I+D (YoY)' },
  'Basic Materials':   { treatment: 'AISC_Change',    label: 'Cambio en AISC ($/oz)' },
  Energy:              { treatment: 'CAPEX_Growth',   label: 'Crecimiento en CAPEX (YoY)' },
  'Financial Services':{ treatment: 'NIM_Change',     label: 'Cambio en Margen Neto de Interés' },
  Financials:          { treatment: 'NIM_Change',     label: 'Cambio en Margen Neto de Interés' },
  Healthcare:          { treatment: 'RND_Growth',     label: 'Crecimiento en I+D (YoY)' },
  Mining:              { treatment: 'AISC_Change',    label: 'Cambio en AISC ($/oz)' },
}

const DEEPSEEK_SYSTEM = (ticker: string, sector: string) => `
Eres un analista financiero causal experto en el framework de López de Prado (2025).
Tu tarea es identificar la variable de TRATAMIENTO más relevante para analizar
el impacto causal en el retorno futuro de la acción ${ticker} en el sector ${sector}.

Variables de tratamiento candidatas (según sector):
- Technology / Healthcare: RND_Growth (crecimiento YoY en I+D)
- Mining / Basic Materials: AISC_Change (cambio en All-In Sustaining Cost $/oz)
- Energy: CAPEX_Growth (crecimiento YoY en CAPEX)
- Financial Services / Financials: NIM_Change (cambio en Net Interest Margin)
- Default (cualquier otro): Revenue_Growth (crecimiento YoY en ingresos)

Basándote en el contenido de la página de Investor Relations, selecciona la variable
más apropiada y justifica brevemente.

Responde EXCLUSIVAMENTE en JSON válido sin markdown:
{"treatment":"VARIABLE_NAME","label":"Descripción legible","rationale":"Una oración de justificación"}
`.trim()

export async function POST(request: Request): Promise<Response> {
  const body = await request.json() as {
    irUrl?: string
    ticker?: string
    sector?: string
  }
  const { irUrl, ticker, sector } = body

  if (!ticker || !sector) {
    return Response.json({ error: 'Missing ticker or sector' }, { status: 400 })
  }

  let irContent = ''

  if (irUrl && !irUrl.includes('google.com/search')) {
    try {
      const res = await fetch(irUrl, { signal: AbortSignal.timeout(8000) })
      if (res.ok) {
        const html = await res.text()
        irContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 8000)
      }
    } catch {
      // ignore fetch errors — fallback to sector default
    }
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  let treatment = SECTOR_TREATMENTS[sector]?.treatment ?? 'Revenue_Growth'
  let label = SECTOR_TREATMENTS[sector]?.label ?? 'Crecimiento en Ingresos (YoY)'
  let rationale = `Seleccionado por sector: ${sector}`

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
          max_tokens: 200,
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(20000),
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
        }
        if (parsed.treatment) treatment = parsed.treatment
        if (parsed.label) label = parsed.label
        if (parsed.rationale) rationale = parsed.rationale
      }
    } catch {
      // use sector defaults if AI fails
    }
  }

  return Response.json({ treatment, label, rationale, irContent })
}
