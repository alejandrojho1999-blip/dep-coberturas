// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DELETE, POST } from './route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/documentos/extraer', () => ({
  extraerTexto: vi.fn(async (_n: string, b: Buffer) => b.toString('utf-8')),
  tipoDocumento: vi.fn(() => 'excel'),
}))

import { createClient } from '@/lib/supabase/server'
import { extraerTexto } from '@/lib/documentos/extraer'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>
const comoCliente = (m: unknown) => m as SupabaseServerClient

const LOTE = '11111111-2222-3333-4444-555555555555'

/** Cliente mínimo: solo lo que la ruta toca en cada camino. */
function clienteMock(opciones: {
  usuario?: { id: string } | null
  yaSubidos?: number
  errorStorage?: string
  errorInsert?: string
} = {}) {
  const { usuario = { id: 'u1' }, yaSubidos = 0, errorStorage, errorInsert } = opciones
  const insertados: Array<Record<string, unknown>> = []
  const subidos: string[] = []

  return {
    insertados,
    subidos,
    cliente: comoCliente({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: usuario } }) },
      storage: {
        from: () => ({
          upload: vi.fn(async (path: string) => {
            subidos.push(path)
            return { error: errorStorage ? { message: errorStorage } : null }
          }),
          remove: vi.fn().mockResolvedValue({ error: null }),
        }),
      },
      from: () => ({
        select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.head) {
            const chain = { eq: () => chain, then: undefined }
            return Object.assign(Promise.resolve({ count: yaSubidos }), {
              eq: () => Object.assign(Promise.resolve({ count: yaSubidos }), { eq: () => Promise.resolve({ count: yaSubidos }) }),
            })
          }
          return {
            eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { storage_path: 'u1/x/0-a.xlsx' } }) }) }),
          }
        },
        insert: (fila: Record<string, unknown>) => {
          insertados.push(fila)
          return {
            select: () => ({
              single: async () =>
                errorInsert
                  ? { data: null, error: { message: errorInsert } }
                  : { data: { id: `id-${insertados.length}` }, error: null },
            }),
          }
        },
        delete: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
      }),
    }),
  }
}

function peticion(campos: Record<string, string>, archivos: Array<[string, string]> = []) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(campos)) fd.append(k, v)
  for (const [nombre, contenido] of archivos) {
    fd.append('files', new File([contenido], nombre, { type: 'application/octet-stream' }))
  }
  return new Request('http://localhost/api/informes/adjuntos', { method: 'POST', body: fd })
}

describe('POST /api/informes/adjuntos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rechaza a quien no ha iniciado sesión', async () => {
    vi.mocked(createClient).mockResolvedValue(clienteMock({ usuario: null }).cliente)
    const res = await POST(peticion({ loteId: LOTE, ticker: 'AAPL' }, [['a.xlsx', 'x']]))
    expect(res.status).toBe(401)
  })

  it('exige un lote con forma de uuid', async () => {
    vi.mocked(createClient).mockResolvedValue(clienteMock().cliente)
    const res = await POST(peticion({ loteId: 'no-es-uuid', ticker: 'AAPL' }, [['a.xlsx', 'x']]))
    expect(res.status).toBe(400)
  })

  it('exige ticker', async () => {
    vi.mocked(createClient).mockResolvedValue(clienteMock().cliente)
    expect((await POST(peticion({ loteId: LOTE }, [['a.xlsx', 'x']]))).status).toBe(400)
  })

  it('exige al menos un archivo', async () => {
    vi.mocked(createClient).mockResolvedValue(clienteMock().cliente)
    expect((await POST(peticion({ loteId: LOTE, ticker: 'AAPL' }))).status).toBe(400)
  })

  it('guarda el archivo con su texto extraído y devuelve el adjunto', async () => {
    const mock = clienteMock()
    vi.mocked(createClient).mockResolvedValue(mock.cliente)

    const res = await POST(peticion({ loteId: LOTE, ticker: 'aapl' }, [['guidance.xlsx', 'Ingresos,1234']]))
    expect(res.status).toBe(200)

    const body = await res.json() as { adjuntos: Array<{ filename: string; chars: number }> }
    expect(body.adjuntos).toHaveLength(1)
    expect(body.adjuntos[0]).toMatchObject({ filename: 'guidance.xlsx', chars: 13 })
    expect(extraerTexto).toHaveBeenCalled()
    expect(mock.insertados[0]).toMatchObject({
      user_id: 'u1',
      lote_id: LOTE,
      ticker: 'AAPL',
      texto_extraido: 'Ingresos,1234',
    })
  })

  it('aísla los archivos por usuario y por lote en Storage', async () => {
    const mock = clienteMock()
    vi.mocked(createClient).mockResolvedValue(mock.cliente)
    await POST(peticion({ loteId: LOTE, ticker: 'AAPL' }, [['un informe raro.pdf', 'x']]))
    // La ruta empieza por el id del usuario: es lo que hacen cumplir las
    // políticas de Storage.
    expect(mock.subidos[0]).toBe(`u1/${LOTE}/0-un_informe_raro.pdf`)
  })

  it('rechaza un formato que no se sabe leer, sin tumbar el resto', async () => {
    const mock = clienteMock()
    vi.mocked(createClient).mockResolvedValue(mock.cliente)

    const res = await POST(peticion({ loteId: LOTE, ticker: 'AAPL' }, [['virus.exe', 'x'], ['bueno.xlsx', 'y']]))
    const body = await res.json() as {
      adjuntos: Array<{ filename: string }>
      rechazados: Array<{ filename: string; motivo: string }>
    }
    expect(body.rechazados).toHaveLength(1)
    expect(body.rechazados[0].filename).toBe('virus.exe')
    expect(body.adjuntos.map(a => a.filename)).toEqual(['bueno.xlsx'])
  })

  it('cuenta el tope contra lo que ya hay en el lote, no contra esta tanda', async () => {
    vi.mocked(createClient).mockResolvedValue(clienteMock({ yaSubidos: 4 }).cliente)
    const res = await POST(peticion({ loteId: LOTE, ticker: 'AAPL' }, [['a.xlsx', 'x'], ['b.xlsx', 'y']]))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ detail: expect.stringContaining('Máximo 5') })
  })

  it('un archivo ilegible se guarda con cero caracteres en vez de perderse', async () => {
    vi.mocked(extraerTexto).mockRejectedValueOnce(new Error('PDF corrupto'))
    const mock = clienteMock()
    vi.mocked(createClient).mockResolvedValue(mock.cliente)

    const res = await POST(peticion({ loteId: LOTE, ticker: 'AAPL' }, [['escaneado.pdf', 'x']]))
    const body = await res.json() as { adjuntos: Array<{ chars: number }> }
    expect(body.adjuntos).toHaveLength(1)
    expect(body.adjuntos[0].chars).toBe(0)
    expect(mock.insertados[0].texto_extraido).toBeNull()
  })
})

describe('DELETE /api/informes/adjuntos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rechaza a quien no ha iniciado sesión', async () => {
    vi.mocked(createClient).mockResolvedValue(clienteMock({ usuario: null }).cliente)
    const res = await DELETE(new Request(`http://localhost/api/informes/adjuntos?id=${LOTE}`, { method: 'DELETE' }))
    expect(res.status).toBe(401)
  })

  it('exige un id con forma de uuid', async () => {
    vi.mocked(createClient).mockResolvedValue(clienteMock().cliente)
    const res = await DELETE(new Request('http://localhost/api/informes/adjuntos?id=1', { method: 'DELETE' }))
    expect(res.status).toBe(400)
  })

  it('borra el adjunto del lote', async () => {
    vi.mocked(createClient).mockResolvedValue(clienteMock().cliente)
    const res = await DELETE(new Request(`http://localhost/api/informes/adjuntos?id=${LOTE}`, { method: 'DELETE' }))
    expect(res.status).toBe(200)
  })
})
