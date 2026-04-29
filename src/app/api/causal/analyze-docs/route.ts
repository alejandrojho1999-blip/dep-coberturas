import { createClient } from '@/lib/supabase/server'
import { getUniqueTreatments, getSectorConfig } from '@/lib/causal/dag-configs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

interface TreatmentRecommendation {
  variable: string
  label: string
  score: number
  rationale: string
}

interface LLMDocResponse {
  recommendations: TreatmentRecommendation[]
  extractedData: Record<string, unknown>
}

const DOC_ANALYSIS_SYSTEM = (ticker: string, sector: string, availableTreatments: string) => `
Eres un analista de inversión causal experto en el framework de López de Prado.
Analiza el contenido del documento financiero de ${ticker} (sector: ${sector}).

TRATAMIENTOS DISPONIBLES (variables cuasi-exógenas del mercado):
${availableTreatments}

Tu tarea:
1. Recomendar las TOP 3 variables de tratamiento cuasi-exógenas más relevantes para este activo.
   Asigna un score 0-100 basado en qué tan bien esa variable macro CAUSA el retorno futuro del activo.
2. Extraer datos financieros clave del documento (ingresos, EPS, guidance, CAPEX, márgenes).

Responde EXCLUSIVAMENTE en JSON válido sin markdown:
{
  "recommendations": [
    {
      "variable": "NOMBRE_VARIABLE",
      "label": "Descripción legible",
      "score": 85,
      "rationale": "Una oración explicando por qué esta variable causa el retorno de ${ticker}"
    }
  ],
  "extractedData": {
    "revenue_growth": null,
    "eps_growth": null,
    "capex_growth": null,
    "net_margin": null,
    "guidance_revenue": null,
    "guidance_eps": null,
    "notes": "Observaciones relevantes del documento"
  }
}
`.trim()

async function extractText(filename: string, buffer: Buffer): Promise<string> {
  const ext = filename.toLowerCase().split('.').pop() ?? ''

  if (ext === 'pdf') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
    const result = await pdfParse(buffer)
    return result.text.slice(0, 12000)
  }

  if (ext === 'docx' || ext === 'doc') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require('mammoth') as { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> }
    const result = await mammoth.extractRawText({ buffer })
    return result.value.slice(0, 12000)
  }

  if (ext === 'xlsx' || ext === 'xls') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx') as {
      read: (buf: Buffer, opts: { type: string }) => { SheetNames: string[]; Sheets: Record<string, unknown> }
      utils: { sheet_to_csv: (sheet: unknown) => string }
    }
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const texts: string[] = []
    for (const sheetName of wb.SheetNames.slice(0, 3)) {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName])
      texts.push(`[${sheetName}]\n${csv.slice(0, 3000)}`)
    }
    return texts.join('\n\n').slice(0, 12000)
  }

  return buffer.toString('utf-8').slice(0, 12000)
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return Response.json({ error: 'OPENROUTER_API_KEY no configurada' }, { status: 500 })

  // Accept multipart/form-data: files + metadata fields
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'Se esperaba multipart/form-data' }, { status: 400 })
  }

  const ticker = (formData.get('ticker') as string | null)?.trim().toUpperCase()
  const sector = (formData.get('sector') as string | null)?.trim() ?? 'default'
  const assetId = (formData.get('assetId') as string | null) ?? undefined

  if (!ticker) return Response.json({ error: 'ticker requerido' }, { status: 400 })

  // Extract text from all uploaded files
  const files = formData.getAll('files') as File[]
  if (!files.length) return Response.json({ error: 'No se recibieron archivos' }, { status: 400 })

  const extractedTexts: string[] = []
  const fileMetadata: { filename: string; docType: string }[] = []

  for (const file of files.slice(0, 5)) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      const text = await extractText(file.name, buffer)
      extractedTexts.push(`[Archivo: ${file.name}]\n${text}`)
      const ext = file.name.toLowerCase().split('.').pop() ?? 'other'
      const docType = ['pdf'].includes(ext) ? 'pdf' : ['xlsx', 'xls'].includes(ext) ? 'excel' : ['docx', 'doc'].includes(ext) ? 'word' : 'other'
      fileMetadata.push({ filename: file.name, docType })
    } catch { /* skip unreadable files */ }
  }

  const combinedText = extractedTexts.join('\n\n---\n\n').slice(0, 15000)

  // Build available treatments list from DAG_CONFIGS
  const treatments = getUniqueTreatments()
  const sectorCfg = getSectorConfig(sector)
  const availableTreatments = treatments
    .map((t) => `- ${t.variable}: ${t.label} (sectores: ${t.sectors.join(', ')})`)
    .join('\n')

  // Call LLM
  let recommendations: TreatmentRecommendation[] = []
  let extractedData: Record<string, unknown> = {}

  try {
    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://dep-coberturas.vercel.app',
        'X-Title': 'Dep Coberturas — Causal Doc Analysis',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-chat-v3-0324',
        messages: [
          { role: 'system', content: DOC_ANALYSIS_SYSTEM(ticker, sector, availableTreatments) },
          { role: 'user', content: `Contenido del documento:\n${combinedText}` },
        ],
        max_tokens: 800,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(45_000),
    })

    if (aiRes.ok) {
      const aiData = await aiRes.json() as { choices?: Array<{ message?: { content?: string } }> }
      const raw = (aiData.choices?.[0]?.message?.content ?? '').trim()
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as LLMDocResponse
        if (Array.isArray(parsed.recommendations)) {
          recommendations = parsed.recommendations.slice(0, 3)
        }
        if (parsed.extractedData && typeof parsed.extractedData === 'object') {
          extractedData = parsed.extractedData
        }
      }
    }
  } catch { /* fallback to sector defaults below */ }

  // Fallback: use DAG_CONFIGS sector default as first recommendation
  if (recommendations.length === 0) {
    recommendations = [
      {
        variable: sectorCfg.treatment as string,
        label: treatments.find((t) => t.variable === sectorCfg.treatment)?.label ?? sectorCfg.treatment as string,
        score: 70,
        rationale: `Tratamiento por defecto para sector ${sector} según DAG_CONFIGS`,
      },
    ]
  }

  // Save to causal_asset_docs for each file
  await Promise.allSettled(
    fileMetadata.map(({ filename, docType }) =>
      supabase.from('causal_asset_docs').insert({
        ticker,
        user_id: user.id,
        asset_id: assetId ?? null,
        filename,
        storage_path: `${user.id}/${ticker}/${filename}`,
        doc_type: docType,
        extracted_data: extractedData,
        treatment_recommendations: recommendations,
        status: 'done',
      })
    )
  )

  // Also save top treatment to causal_variables for future selection
  if (recommendations[0]) {
    await supabase.from('causal_variables').upsert(
      {
        user_id: user.id,
        ticker,
        variable: recommendations[0].variable,
        type: 'treatment',
        source: 'auto',
        label: recommendations[0].label,
        rationale: recommendations[0].rationale,
      },
      { onConflict: 'user_id,ticker,variable,type' }
    )
  }

  return Response.json({ recommendations, extractedData })
}
