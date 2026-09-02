import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildSystemPrompt, extractJson, generateContent } from './prompt'

describe('buildSystemPrompt', () => {
  it('sin adjuntos no menciona la tesis: el prompt en producción no se toca', () => {
    const p = buildSystemPrompt(false)
    expect(p).not.toContain('MODO TESIS')
    expect(p).not.toContain('trazabilidad')
    // Por defecto también es el camino conservador.
    expect(buildSystemPrompt()).toBe(p)
  })

  it('con adjuntos conserva íntegro el prompt base y añade el bloque de tesis', () => {
    const base = buildSystemPrompt(false)
    const conAdjuntos = buildSystemPrompt(true)
    expect(conAdjuntos.startsWith(base)).toBe(true)
    expect(conAdjuntos).toContain('MODO TESIS DE INVERSIÓN')
  })

  it('declara la precedencia y la regla que impide inventar cifras', () => {
    const p = buildSystemPrompt(true)
    expect(p).toContain('PRECEDENCIA DE DATOS')
    // La regla que sostiene todo el diseño.
    expect(p).toContain('esa cifra NO')
    expect(p).toContain('nombre EXACTO del archivo')
  })

  it('pide los campos de la tesis, incluidos los invalidadores', () => {
    const p = buildSystemPrompt(true)
    for (const campo of [
      'tesis_central',
      'horizonte',
      'catalizadores',
      'invalidadores',
      'valoracion_propia',
      'trazabilidad',
    ]) {
      expect(p).toContain(campo)
    }
  })
})

describe('extractJson', () => {
  const contenido = { ticker: 'AAPL', resumen: 'x' }

  it('parsea una respuesta que ya es JSON', () => {
    expect(extractJson(JSON.stringify(contenido))).toMatchObject(contenido)
  })

  it('parsea JSON envuelto en un bloque de markdown', () => {
    expect(extractJson('```json\n' + JSON.stringify(contenido) + '\n```')).toMatchObject(contenido)
  })

  it('rescata el JSON de una respuesta con texto alrededor', () => {
    expect(extractJson(`Aquí tienes:\n${JSON.stringify(contenido)}\nEspero que sirva.`)).toMatchObject(contenido)
  })

  it('lanza cuando no hay JSON que rescatar', () => {
    expect(() => extractJson('lo siento, no puedo')).toThrow()
  })
})

describe('generateContent', () => {
  const respuesta = (contenido: object) => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(contenido) } }] }),
  })

  const cuerpoDeLaLlamada = (fetchMock: ReturnType<typeof vi.fn>) =>
    JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      max_tokens: number
      messages: Array<{ role: string; content: string }>
    }

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'clave-de-prueba'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.OPENROUTER_API_KEY
  })

  it('sin adjuntos conserva el tope de salida probado', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta({ ticker: 'AAPL' }))
    vi.stubGlobal('fetch', fetchMock)

    await generateContent('aapl', 'contexto de mercado', 3)

    const cuerpo = cuerpoDeLaLlamada(fetchMock)
    expect(cuerpo.max_tokens).toBe(4500)
    expect(cuerpo.messages[0].content).not.toContain('MODO TESIS')
    expect(cuerpo.messages[1].content).toContain('informe de inversión institucional')
  })

  it('con adjuntos amplía la salida y les pasa el texto al modelo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta({ ticker: 'AAPL' }))
    vi.stubGlobal('fetch', fetchMock)

    await generateContent('aapl', 'contexto', 3, '[FUENTE 1 — guidance.xlsx (excel)]\nIngresos,1234')

    const cuerpo = cuerpoDeLaLlamada(fetchMock)
    expect(cuerpo.max_tokens).toBe(7000)
    expect(cuerpo.messages[0].content).toContain('MODO TESIS DE INVERSIÓN')
    expect(cuerpo.messages[1].content).toContain('guidance.xlsx')
    expect(cuerpo.messages[1].content).toContain('la tesis de inversión')
  })

  it('sin clave de API no llama a nadie', async () => {
    delete process.env.OPENROUTER_API_KEY
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(generateContent('aapl', 'contexto', 1)).rejects.toThrow('OPENROUTER_API_KEY')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('propaga el error del proveedor con su código', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => 'rate limit' }))
    await expect(generateContent('aapl', 'contexto', 1)).rejects.toThrow('429')
  })
})
