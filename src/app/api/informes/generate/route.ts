import { createClient } from '@/lib/supabase/server'
import { fetchMarketData, buildDataContext } from '@/lib/informes/yahoo'
import { generateContent, currentMesAño } from '@/lib/informes/prompt'
import { createDocxBuffer, buildFilename } from '@/lib/informes/docx'
import { construirContextoAdjuntos, resumirFuentes } from '@/lib/informes/adjuntos'
import { validarTrazabilidad, valoracionRespaldada } from '@/lib/informes/trazabilidad'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { ticker?: string; force?: boolean; loteId?: string }
  const ticker = body.ticker?.trim().toUpperCase()
  const force = body.force ?? false
  const loteId = body.loteId?.trim() || null
  if (!ticker) return Response.json({ detail: 'ticker requerido' }, { status: 400 })

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return Response.json({ detail: 'OPENROUTER_API_KEY no configurada' }, { status: 500 })
  }

  // Duplicate check: same ticker + same user in last 24h
  if (!force) {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: dupCount } = await supabase
      .from('informes_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('ticker', ticker)
      .gte('created_at', since24h)

    if ((dupCount ?? 0) > 0) {
      return Response.json(
        { detail: `Ya generaste un informe de ${ticker} en las últimas 24 horas.`, code: 'DUPLICATE' },
        { status: 409 }
      )
    }
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

  // Archivos que el usuario aportó para esta tesis. Sin lote, o con un lote
  // vacío, el flujo es exactamente el de siempre y sale un informe.
  const { data: adjuntos } = loteId
    ? await supabase
        .from('informe_adjuntos')
        .select('id, filename, doc_type, texto_extraido')
        .eq('user_id', user.id)
        .eq('lote_id', loteId)
        .order('created_at', { ascending: true })
    : { data: null }

  const conAdjuntos = (adjuntos ?? []).length > 0
  const contextoAdjuntos = conAdjuntos ? construirContextoAdjuntos(adjuntos ?? []) : ''

  // Generate content via LLM
  let content
  try {
    content = await generateContent(ticker, dataContext, informeNumero, contextoAdjuntos)
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

  // Comprobación de la trazabilidad. El prompt pide al modelo que señale de qué
  // archivo sale cada cifra, pero la garantía no puede ser que lo prometa: cada
  // valor se busca literalmente en el texto extraído del archivo que dice
  // citar, y lo que no aparece no llega al documento.
  if (conAdjuntos) {
    content.tipo_documento = 'tesis'
    const { verificados, descartados } = validarTrazabilidad(content.trazabilidad, adjuntos ?? [])
    content.trazabilidad = verificados
    content.valoracion_propia = valoracionRespaldada(content.valoracion_propia, verificados)
    content.fuentes_adjuntas = resumirFuentes(adjuntos ?? [])
    if (descartados > 0) {
      console.warn(`[informes/generate] ${descartados} referencias sin respaldo descartadas para ${ticker}`)
    }
  } else {
    // Sin archivos no hay tesis que sostener: si el modelo se adelantó, se
    // retiran los campos que no puede respaldar nadie.
    delete content.tipo_documento
    delete content.trazabilidad
    delete content.valoracion_propia
    delete content.fuentes_adjuntas
  }

  // Build DOCX
  let docxBuffer: Buffer
  try {
    docxBuffer = await createDocxBuffer(content, marketData, autoSolicitante ?? undefined)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return Response.json({ detail: `Error generando DOCX: ${msg}` }, { status: 500 })
  }

  const filename = buildFilename(ticker, content.mes_año, conAdjuntos ? 'tesis' : 'informe')

  // Persist to Supabase
  const { data: filaInforme, error: dbErr } = await supabase
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
    .select('id')
    .single()

  if (dbErr) {
    console.error('[informes/generate] DB insert error:', dbErr.message)
  }

  // Los adjuntos se subieron antes de que existiera esta fila, así que es ahora
  // cuando se les puede poner el informe al que alimentaron.
  if (loteId && filaInforme?.id) {
    await supabase
      .from('informe_adjuntos')
      .update({ informe_id: filaInforme.id })
      .eq('user_id', user.id)
      .eq('lote_id', loteId)
  }

  const meta = {
    ticker:            content.ticker,
    empresa:           content.empresa,
    bolsa:             content.bolsa,
    filename,
    solicitante:       autoSolicitante,
    informe_numero:    informeNumero,
    fecha_generacion:  new Date().toISOString(),
    tipo_documento:    conAdjuntos ? 'tesis' : 'informe',
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
