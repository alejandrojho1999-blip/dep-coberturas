// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { MAX_CHARS_ARCHIVO, extraerTexto, tipoDocumento } from './extraer'

// pdf-parse 2.x expone una clase; el mock imita esa forma, no la función
// suelta de la versión 1.
vi.mock('pdf-parse', () => ({
  PDFParse: class {
    private data: Uint8Array
    constructor({ data }: { data: Uint8Array }) { this.data = data }
    async getText() { return { text: `PDF:${Buffer.from(this.data).toString('utf-8')}` } }
    async destroy() {}
  },
}))

vi.mock('mammoth', () => ({
  extractRawText: async ({ buffer }: { buffer: Buffer }) => ({ value: `WORD:${buffer.toString('utf-8')}` }),
}))

describe('tipoDocumento', () => {
  it('clasifica por extensión, sin importar las mayúsculas', () => {
    expect(tipoDocumento('memoria.PDF')).toBe('pdf')
    expect(tipoDocumento('cuentas.xlsx')).toBe('excel')
    expect(tipoDocumento('cuentas.xls')).toBe('excel')
    expect(tipoDocumento('acta.docx')).toBe('word')
    expect(tipoDocumento('acta.doc')).toBe('word')
    expect(tipoDocumento('serie.csv')).toBe('csv')
  })

  it('lo desconocido no es un error, es "other"', () => {
    expect(tipoDocumento('notas.txt')).toBe('other')
    expect(tipoDocumento('sinextension')).toBe('other')
  })
})

describe('extraerTexto', () => {
  it('lee un libro de Excel como CSV, hoja por hoja', async () => {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Concepto', 'Valor'], ['Ingresos', 1234]]), 'Q3')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    const texto = await extraerTexto('cuentas.xlsx', buf)
    expect(texto).toContain('[Q3]')
    expect(texto).toContain('Ingresos,1234')
  })

  it('solo lee las tres primeras hojas de un libro', async () => {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    for (const nombre of ['H1', 'H2', 'H3', 'H4']) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[nombre]]), nombre)
    }
    const texto = await extraerTexto('libro.xlsx', XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer)
    expect(texto).toContain('[H3]')
    expect(texto).not.toContain('[H4]')
  })

  it('delega el PDF y el Word en sus librerías', async () => {
    expect(await extraerTexto('memoria.pdf', Buffer.from('cuerpo'))).toBe('PDF:cuerpo')
    expect(await extraerTexto('acta.docx', Buffer.from('cuerpo'))).toBe('WORD:cuerpo')
  })

  it('un formato desconocido se lee como texto plano en vez de fallar', async () => {
    expect(await extraerTexto('notas.txt', Buffer.from('hola'))).toBe('hola')
  })

  it('trunca lo que no cabe en el prompt', async () => {
    const largo = Buffer.from('x'.repeat(MAX_CHARS_ARCHIVO * 2))
    expect((await extraerTexto('notas.txt', largo))).toHaveLength(MAX_CHARS_ARCHIVO)
    expect((await extraerTexto('memoria.pdf', largo))).toHaveLength(MAX_CHARS_ARCHIVO)
  })
})
