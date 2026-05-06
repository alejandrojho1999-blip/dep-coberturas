import { createClient } from '@/lib/supabase/server'
import { fetchMarketData } from '@/lib/informes/yahoo'
import { createDocxBuffer } from '@/lib/informes/docx'
import type { ReportContent } from '@/lib/informes/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const ADMIN_EMAILS = new Set(['lriofrio915@gmail.com', 'walletserick123@gmail.com'])

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json() as { id?: string }
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const isAdmin = ADMIN_EMAILS.has(user.email ?? '')

  // Fetch the existing record — admin can get any, user only their own
  let query = supabase
    .from('informes_history')
    .select('ticker, empresa, solicitante, filename, content_json')
    .eq('id', id)
  if (!isAdmin) query = query.eq('user_id', user.id)

  const { data, error } = await query.single()
  if (error || !data) return Response.json({ error: 'Registro no encontrado' }, { status: 404 })

  const content = data.content_json as ReportContent | null
  if (!content) return Response.json({ error: 'content_json no disponible para este informe' }, { status: 422 })

  // Re-fetch market data for up-to-date chart and income history (no DB insert)
  let marketData
  try {
    marketData = await fetchMarketData(data.ticker as string)
  } catch {
    // If Yahoo fails, build a minimal marketData from content_json
    marketData = {
      ticker: content.ticker,
      empresa: content.empresa,
      bolsa: content.bolsa,
      precio_actual: content.precio_actual,
      precio_52w_alto: null,
      precio_52w_bajo: null,
      market_cap: null,
      beta: null,
      shares_outstanding: null,
      moneda: 'USD',
      sector: null,
      industria: null,
      descripcion: null,
      pe_ratio: null,
      ps_ratio: null,
      ev_ebitda: null,
      margen_bruto: null,
      margen_neto: null,
      margen_operacional: null,
      eps: null,
      deuda_total: null,
      caja_total: null,
      precio_objetivo: content.precio_objetivo,
      recomendacion: null,
      strong_buy: 0, buy: 0, hold: 0, sell: 0, strong_sell: 0,
      historial_ingresos: [],
      historial_precios: [],
      free_cashflow: null,
      fcf_history: [],
      dcf_value: null,
      revenue_growth_rate: null,
    }
  }

  const solicitante = (data.solicitante as string | null) ?? undefined
  let docxBuffer: Buffer
  try {
    docxBuffer = await createDocxBuffer(content, marketData, solicitante)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `Error generando DOCX: ${msg}` }, { status: 500 })
  }

  const filename = (data.filename as string) || `${content.ticker}_Informe.docx`

  return new Response(new Uint8Array(docxBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
