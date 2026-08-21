import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { assetId?: string; message?: string }
  if (!body.assetId || !body.message) {
    return Response.json({ error: 'Missing assetId or message' }, { status: 400 })
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    console.error('[causal/chat] OPENROUTER_API_KEY is not set in environment')
    return Response.json({ error: 'OPENROUTER_API_KEY no configurada en el servidor' }, { status: 500 })
  }

  const { data: asset } = await supabase
    .from('causal_assets')
    .select('ticker, ir_content, last_score, last_signal, config')
    .eq('id', body.assetId)
    .eq('user_id', user.id)
    .single()

  if (!asset) return Response.json({ error: 'Asset not found' }, { status: 404 })

  const systemPrompt = `Eres un analista financiero causal especializado en el framework de López de Prado (2025).
Estás analizando el activo ${asset.ticker}.
Score causal actual: ${asset.last_score ?? 'no calculado'}/100 — Señal: ${asset.last_signal ?? 'pendiente'}.
Tratamiento: ${(asset.config as { treatment?: string })?.treatment ?? 'desconocido'}.

${asset.ir_content ? `Contexto de la página Investor Relations:\n${asset.ir_content.slice(0, 4000)}` : ''}

Responde de forma concisa y técnica. Usa términos del análisis causal cuando sea relevante.`

  let aiRes: Response
  try {
    aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      signal: AbortSignal.timeout(15000),
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://dep-coberturas.vercel.app',
        'X-Title': 'SynerGy — Causal Chat',
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: body.message },
        ],
        max_tokens: 600,
        temperature: 0.3,
        stream: true,
      }),
    })
  } catch (fetchErr) {
    console.error('[causal/chat] Network error calling OpenRouter:', fetchErr)
    return Response.json({ error: 'Error de red al conectar con OpenRouter' }, { status: 500 })
  }

  if (!aiRes.ok) {
    const err = await aiRes.text()
    console.error('[causal/chat] OpenRouter error', aiRes.status, err)
    return Response.json({ error: `OpenRouter ${aiRes.status}: ${err}` }, { status: 500 })
  }

  return new Response(aiRes.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
