import { createClient } from '@/lib/supabase/server'
import { extraerTexto, tipoDocumento } from '@/lib/documentos/extraer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * Archivos que alimentan una tesis de inversión.
 *
 * La subida pasa por el servidor, a diferencia del Word editado que va directo
 * del navegador a Storage: aquí hay que extraer el texto —`pdf-parse`,
 * `mammoth` y `xlsx` solo corren en Node— y así el tipo, el tamaño y el
 * recuento se validan en un único sitio.
 */

/** Coincide con el `allowed_mime_types` del bucket de la migración 026. */
const EXTENSIONES = ['xlsx', 'xls', 'docx', 'doc', 'pdf', 'csv'] as const

const MAX_ARCHIVOS = 5
const MAX_BYTES = 10 * 1024 * 1024

/** Nombre seguro para una ruta de Storage, conservando la extensión. */
function sanear(filename: string): string {
  return filename
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ detail: 'Unauthorized' }, { status: 401 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ detail: 'Se esperaba multipart/form-data' }, { status: 400 })
  }

  const loteId = (formData.get('loteId') as string | null)?.trim()
  const ticker = (formData.get('ticker') as string | null)?.trim().toUpperCase()
  if (!loteId || !UUID.test(loteId)) {
    return Response.json({ detail: 'loteId inválido' }, { status: 400 })
  }
  if (!ticker) return Response.json({ detail: 'ticker requerido' }, { status: 400 })

  const files = formData.getAll('files').filter((f): f is File => f instanceof File)
  if (files.length === 0) return Response.json({ detail: 'No se recibieron archivos' }, { status: 400 })

  // El recuento se cuenta contra lo que ya hay en el lote, no contra esta
  // tanda: si no, cinco tandas de uno se saltarían el tope.
  const { count: yaSubidos } = await supabase
    .from('informe_adjuntos')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('lote_id', loteId)

  if ((yaSubidos ?? 0) + files.length > MAX_ARCHIVOS) {
    return Response.json(
      { detail: `Máximo ${MAX_ARCHIVOS} archivos por tesis` },
      { status: 400 },
    )
  }

  const guardados: Array<{ id: string; filename: string; doc_type: string; size_bytes: number; chars: number }> = []
  const rechazados: Array<{ filename: string; motivo: string }> = []

  for (const [i, file] of files.entries()) {
    const tipo = tipoDocumento(file.name)
    const ext = file.name.toLowerCase().split('.').pop() ?? ''
    if (!EXTENSIONES.includes(ext as (typeof EXTENSIONES)[number])) {
      rechazados.push({ filename: file.name, motivo: 'formato no admitido' })
      continue
    }
    if (file.size > MAX_BYTES) {
      rechazados.push({ filename: file.name, motivo: 'supera los 10 MB' })
      continue
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // Un archivo ilegible se guarda igual, con el texto vacío: aparecerá en el
    // anexo con cero caracteres, que es información honesta. Perder el lote
    // entero por un PDF escaneado sería peor.
    let texto = ''
    try {
      texto = await extraerTexto(file.name, buffer)
    } catch (e) {
      console.warn(`[adjuntos] no se pudo leer ${file.name}:`, e)
    }

    const storagePath = `${user.id}/${loteId}/${(yaSubidos ?? 0) + i}-${sanear(file.name)}`
    const { error: errStorage } = await supabase.storage
      .from('informe-adjuntos')
      .upload(storagePath, buffer, { contentType: file.type || 'application/octet-stream', upsert: true })

    if (errStorage) {
      rechazados.push({ filename: file.name, motivo: errStorage.message })
      continue
    }

    const { data, error } = await supabase
      .from('informe_adjuntos')
      .insert({
        user_id: user.id,
        lote_id: loteId,
        ticker,
        filename: file.name,
        storage_path: storagePath,
        doc_type: tipo,
        size_bytes: file.size,
        texto_extraido: texto || null,
        chars_extraidos: texto.length,
      })
      .select('id')
      .single()

    if (error || !data) {
      rechazados.push({ filename: file.name, motivo: error?.message ?? 'no se pudo registrar' })
      continue
    }

    guardados.push({
      id: data.id,
      filename: file.name,
      doc_type: tipo,
      size_bytes: file.size,
      chars: texto.length,
    })
  }

  return Response.json({ adjuntos: guardados, rechazados })
}

/** Quita un adjunto del lote antes de generar. */
export async function DELETE(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ detail: 'Unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id || !UUID.test(id)) return Response.json({ detail: 'id inválido' }, { status: 400 })

  const { data: fila } = await supabase
    .from('informe_adjuntos')
    .select('storage_path')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!fila) return Response.json({ detail: 'No encontrado' }, { status: 404 })

  await supabase.storage.from('informe-adjuntos').remove([fila.storage_path])
  const { error } = await supabase.from('informe_adjuntos').delete().eq('id', id).eq('user_id', user.id)
  if (error) return Response.json({ detail: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
