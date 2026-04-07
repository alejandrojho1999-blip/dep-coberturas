import { createClient } from '@/lib/supabase/server'
import { parseUploadedFile } from '@/lib/data/parser'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ACCEPTED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel',                                           // xls
  'text/csv',
  'application/csv',
]

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.includes('multipart/form-data')) {
    return Response.json({ error: 'Request must be multipart/form-data' }, { status: 400 })
  }

  const formData = await request.formData()
  const file = formData.get('file')

  if (!file || !(file instanceof File)) {
    return Response.json({ error: 'Missing required field: file' }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE) {
    return Response.json({ error: 'File exceeds maximum size of 10MB' }, { status: 413 })
  }

  const mimeType = file.type
  const isAccepted =
    ACCEPTED_MIME_TYPES.includes(mimeType) ||
    file.name.endsWith('.xlsx') ||
    file.name.endsWith('.csv')

  if (!isAccepted) {
    return Response.json(
      { error: `Unsupported file type: ${mimeType}. Accepted: xlsx, csv` },
      { status: 415 }
    )
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const parseResult = parseUploadedFile(buffer, mimeType)
  return Response.json({ parseResult })
}
