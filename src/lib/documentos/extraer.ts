/**
 * Extracción de texto de documentos ofimáticos.
 *
 * Un Excel, un Word y un PDF no se parecen en nada por dentro, pero para un
 * modelo de lenguaje los tres son lo mismo: texto plano con el que razonar. Este
 * módulo hace esa traducción y nada más — no interpreta, no resume, no juzga.
 *
 * Las importaciones son dinámicas a propósito: `pdf-parse`, `mammoth` y `xlsx`
 * tocan el sistema de ficheros al cargarse y están declarados en
 * `serverExternalPackages`, así que solo deben cargarse cuando de verdad llega
 * un archivo de ese tipo.
 */

/** Tope de caracteres por archivo. Lo que pase de aquí no cabe en el prompt. */
export const MAX_CHARS_ARCHIVO = 12_000

/** Hojas de un libro que se leen, y cuánto de cada una. */
const MAX_HOJAS = 3
const MAX_CHARS_HOJA = 3_000

export type TipoDocumento = 'excel' | 'word' | 'pdf' | 'csv' | 'other'

function extension(filename: string): string {
  return filename.toLowerCase().split('.').pop() ?? ''
}

/** Clasifica por extensión. Es lo que se guarda como `doc_type`. */
export function tipoDocumento(filename: string): TipoDocumento {
  const ext = extension(filename)
  if (ext === 'pdf') return 'pdf'
  if (ext === 'csv') return 'csv'
  if (ext === 'xlsx' || ext === 'xls') return 'excel'
  if (ext === 'docx' || ext === 'doc') return 'word'
  return 'other'
}

/**
 * pdf-parse 2.x exporta una clase, no la función suelta de la versión 1.
 *
 * El código heredado llamaba al módulo como si fuera invocable y habría lanzado
 * «pdfParse is not a function» con el primer PDF real. No se notó porque la
 * ruta que lo usaba no tenía quien la llamara.
 */
async function textoDePdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    const { text } = await parser.getText()
    return text.slice(0, MAX_CHARS_ARCHIVO)
  } finally {
    await parser.destroy()
  }
}

async function textoDeWord(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth')
  const { value } = await mammoth.extractRawText({ buffer })
  return value.slice(0, MAX_CHARS_ARCHIVO)
}

/** Cada hoja se vuelca como CSV: es la forma más compacta de dar una tabla. */
async function textoDeExcel(buffer: Buffer): Promise<string> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const hojas = wb.SheetNames.slice(0, MAX_HOJAS).map((nombre) => {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[nombre])
    return `[${nombre}]\n${csv.slice(0, MAX_CHARS_HOJA)}`
  })
  return hojas.join('\n\n').slice(0, MAX_CHARS_ARCHIVO)
}

/**
 * Devuelve el texto legible de un archivo, truncado a `MAX_CHARS_ARCHIVO`.
 *
 * Un formato desconocido se lee como utf-8 en vez de fallar: un `.txt` o un
 * `.md` sueltos son perfectamente útiles y no merecen un caso propio.
 */
export async function extraerTexto(filename: string, buffer: Buffer): Promise<string> {
  const ext = extension(filename)
  if (ext === 'pdf') return textoDePdf(buffer)
  if (ext === 'docx' || ext === 'doc') return textoDeWord(buffer)
  if (ext === 'xlsx' || ext === 'xls') return textoDeExcel(buffer)
  return buffer.toString('utf-8').slice(0, MAX_CHARS_ARCHIVO)
}
