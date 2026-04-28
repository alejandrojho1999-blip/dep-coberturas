import { createClient } from '@/lib/supabase/server'
import { fetchMarketData, buildDataContext } from '@/lib/informes/yahoo'
import { generateContent, currentMesAño } from '@/lib/informes/prompt'
import { createDocxBuffer, buildFilename } from '@/lib/informes/docx'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { ticker?: string }
  const ticker = body.ticker?.trim().toUpperCase()
  if (!ticker) return Response.json({ detail: 'ticker requerido' }, { status: 400 })

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return Response.json({ detail: 'OPENROUTER_API_KEY no configurada' }, { status: 500 })
  }

  // Auto-fill solicitante from the user's registered full_name
  const autoSolicitante = (user.user_metadata?.full_name as string | null)
    ?? user.email
    ?? null

  // Get next informe number for this user
  const { count } = await supabase
    .from('informes_history')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
  const informeNumero = (count ?? 0) + 1

  // Fetch market data
  let marketData
  try {
    marketData = await fetchMarketData(ticker)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return Response.json({ detail: `Error obteniendo datos de Yahoo Finance: ${msg}` }, { status: 422 })
  }

  const dataContext = buildDataContext(marketData)

  // Generate content via LLM
  let content
  try {
    content = await generateContent(ticker, dataContext, informeNumero)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return Response.json({ detail: `Error generando contenido: ${msg}` }, { status: 500 })
  }

  // Force critical fields from market data (never trust LLM for prices)
  content.ticker  = marketData.ticker
  content.empresa = marketData.empresa
  content.bolsa   = marketData.bolsa
  if (marketData.precio_actual != null) content.precio_actual = marketData.precio_actual
  if (marketData.precio_objetivo != null) content.precio_objetivo = marketData.precio_objetivo
  if (!content.mes_año) content.mes_año = currentMesAño()
  content.informe_numero = informeNumero

  // Build DOCX
  let docxBuffer: Buffer
  try {
    docxBuffer = await createDocxBuffer(content, marketData, autoSolicitante ?? undefined)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return Response.json({ detail: `Error generando DOCX: ${msg}` }, { status: 500 })
  }

  const filename = buildFilename(ticker, content.mes_año)

  // Persist to Supabase
  const { error: dbErr } = await supabase
    .from('informes_history')
    .insert({
      user_id:          user.id,
      user_email:       user.email ?? null,
      ticker:           content.ticker,
      empresa:          content.empresa,
      bolsa:            content.bolsa,
      solicitante:               autoSolicitante,
      filename,
      informe_numero:            informeNumero,
      content_json:              content,
      precio_compra:             marketData.precio_actual ?? null,
      precio_objetivo_personal:  marketData.precio_objetivo ?? null,
      estado:                    'Observacion',
    })

  if (dbErr) {
    console.error('[informes/generate] DB insert error:', dbErr.message)
  }

  const meta = {
    ticker:            content.ticker,
    empresa:           content.empresa,
    bolsa:             content.bolsa,
    filename,
    solicitante:       autoSolicitante,
    informe_numero:    informeNumero,
    fecha_generacion:  new Date().toISOString(),
  }

  return new Response(new Uint8Array(docxBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Informe-Meta': Buffer.from(JSON.stringify(meta)).toString('base64'),
      'Cache-Control': 'no-store',
    },
  })
}
